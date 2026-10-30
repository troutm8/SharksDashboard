import { NextResponse } from "next/server";
import { NHL_WEB_BASE, landingSchema, scoreDaySchema } from "@/ingest/sources/nhl-web";
import { summaryOf } from "@/ingest/jobs/boxscores";
import { liveFromScore, type LiveDay, type LiveGameDetail } from "@/lib/live";
import { isValidYmd, todayPacific } from "@/lib/season";

export const dynamic = "force-dynamic";

/**
 * Live overlay, proxied from the NHL so the browser never talks to api-web.nhle.com directly.
 *   /api/live?date=YYYY-MM-DD   every game that day: state, period, clock, score, shots
 *   /api/live?game=ID           one game with its scoring summary and three stars
 * The upstream caches for 19 seconds; so do we.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const gameParam = url.searchParams.get("game");
  try {
    if (gameParam && /^\d+$/.test(gameParam)) {
      const res = await fetch(`${NHL_WEB_BASE}/gamecenter/${gameParam}/landing`, { next: { revalidate: 20 } });
      if (!res.ok) return NextResponse.json({ error: `nhl ${res.status}` }, { status: 502 });
      const landing = landingSchema.parse(await res.json());
      const body: LiveGameDetail = {
        fetchedAt: new Date().toISOString(),
        game: liveFromScore({
          id: landing.id,
          gameState: landing.gameState,
          periodDescriptor: landing.periodDescriptor,
          clock: landing.clock,
          homeTeam: landing.homeTeam,
          awayTeam: landing.awayTeam,
        }),
        summary: summaryOf(landing),
      };
      return NextResponse.json(body, { headers: { "cache-control": "public, max-age=15" } });
    }
    const q = url.searchParams.get("date") ?? undefined;
    const date = isValidYmd(q) ? q : todayPacific();
    const res = await fetch(`${NHL_WEB_BASE}/score/${date}`, { next: { revalidate: 20 } });
    if (!res.ok) return NextResponse.json({ error: `nhl ${res.status}` }, { status: 502 });
    const day = scoreDaySchema.parse(await res.json());
    const body: LiveDay = { fetchedAt: new Date().toISOString(), date, games: day.games.map(liveFromScore) };
    return NextResponse.json(body, { headers: { "cache-control": "public, max-age=15" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
