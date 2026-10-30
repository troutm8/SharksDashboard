import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { GameEvent, GameGoalieStat, GameSkaterStat, Team } from "@/db/schema";
import { Card, Empty } from "@/components/Card";
import { LiveGameCard } from "@/components/LiveGameCard";
import { ShotMap, ShotMapLegend, isShotAttempt } from "@/components/ShotMap";
import { TeamLogo } from "@/components/TeamLogo";
import { finalSuffix, fmtDateTime, fmtToi, fmtYmdLong, num, pct3, periodLabel, signed } from "@/lib/format";
import { getGame, getTeamGames } from "@/lib/queries";
import { TEAM_ID, statusOf } from "@/lib/season";
import { gameView, teamView } from "@/lib/views";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getGame(Number(id)) : null;
  return { title: data ? `${data.game.away.abbrev} at ${data.game.home.abbrev}, ${data.game.gameDate}` : "Game" };
}

function SkaterTable({ rows, team }: { rows: GameSkaterStat[]; team: Team }) {
  return (
    <div className="scroll-x">
      <table className="data w-full text-sm">
        <thead>
          <tr>
            <th>{team.commonName}</th>
            <th className="r">G</th>
            <th className="r">A</th>
            <th className="r">P</th>
            <th className="r">+/-</th>
            <th className="r">PIM</th>
            <th className="r">SOG</th>
            <th className="r">Hits</th>
            <th className="r">Blk</th>
            <th className="r">GV</th>
            <th className="r">TK</th>
            <th className="r">FO%</th>
            <th className="r">TOI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.playerId}>
              <td>
                <Link href={`/players/${s.playerId}`} className="hover:underline">
                  <span className="mr-1 text-xs text-muted tabular">{s.sweaterNumber}</span>
                  {s.name} <span className="text-xs text-muted">{s.position}</span>
                </Link>
              </td>
              <td className="r tabular">{s.goals}</td>
              <td className="r tabular">{s.assists}</td>
              <td className="r font-semibold tabular">{s.points}</td>
              <td className="r tabular">{signed(s.plusMinus)}</td>
              <td className="r tabular">{s.pim}</td>
              <td className="r tabular">{s.sog}</td>
              <td className="r tabular">{s.hits}</td>
              <td className="r tabular">{s.blockedShots}</td>
              <td className="r tabular">{s.giveaways}</td>
              <td className="r tabular">{s.takeaways}</td>
              <td className="r tabular">{s.faceoffPct && Number(s.faceoffPct) > 0 ? `${(Number(s.faceoffPct) * 100).toFixed(0)}` : "—"}</td>
              <td className="r tabular">{fmtToi(s.toiSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoalieTable({ rows }: { rows: GameGoalieStat[] }) {
  return (
    <div className="scroll-x">
      <table className="data w-full text-sm">
        <thead>
          <tr>
            <th>Goalie</th>
            <th className="r">Dec</th>
            <th className="r">SA</th>
            <th className="r">SV</th>
            <th className="r">GA</th>
            <th className="r">SV%</th>
            <th className="r">EV</th>
            <th className="r">PP</th>
            <th className="r">SH</th>
            <th className="r">TOI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.playerId}>
              <td>
                <Link href={`/players/${g.playerId}`} className="hover:underline">
                  <span className="mr-1 text-xs text-muted tabular">{g.sweaterNumber}</span>
                  {g.name}
                  {g.starter ? "" : <span className="ml-1 text-xs text-muted">(relief)</span>}
                </Link>
              </td>
              <td className="r tabular">{g.decision ?? ""}</td>
              <td className="r tabular">{g.shotsAgainst}</td>
              <td className="r tabular">{g.saves}</td>
              <td className="r tabular">{g.goalsAgainst}</td>
              <td className="r tabular">{pct3(g.savePctg)}</td>
              <td className="r text-xs tabular">{g.evShotsAgainst}</td>
              <td className="r text-xs tabular">{g.ppShotsAgainst}</td>
              <td className="r text-xs tabular">{g.shShotsAgainst}</td>
              <td className="r tabular">{fmtToi(g.toiSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Per-team totals pulled from the stored box score and events. */
function teamTotals(teamId: number, skaters: GameSkaterStat[], events: GameEvent[]) {
  const mine = skaters.filter((s) => s.teamId === teamId);
  const sum = (f: (s: GameSkaterStat) => number | null) => mine.reduce((a, s) => a + (f(s) ?? 0), 0);
  const faceoffs = events.filter((e) => e.typeDescKey === "faceoff");
  const foWins = faceoffs.filter((e) => e.teamId === teamId).length;
  const penalties = events.filter((e) => e.typeDescKey === "penalty" && e.teamId !== teamId && ["MIN", "MAJ", "BEN"].includes(String(e.details?.typeCode ?? "")));
  return {
    goals: sum((s) => s.goals),
    ppGoals: sum((s) => s.ppGoals),
    ppOpps: penalties.length,
    pim: sum((s) => s.pim),
    hits: sum((s) => s.hits),
    blocks: sum((s) => s.blockedShots),
    giveaways: sum((s) => s.giveaways),
    takeaways: sum((s) => s.takeaways),
    faceoffPct: faceoffs.length ? (foWins / faceoffs.length) * 100 : null,
    attempts: events.filter((e) => isShotAttempt(e) && e.teamId === teamId).length,
  };
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await getGame(Number(id));
  if (!data) notFound();
  const { game, skaters, goalies, events } = data;
  const g = gameView(game);
  const status = statusOf(game.gameState);
  const featuredIn = game.homeTeamId === TEAM_ID || game.awayTeamId === TEAM_ID;
  const featuredId = featuredIn ? TEAM_ID : game.homeTeamId;
  const loaded = game.boxscoreLoaded && skaters.length > 0;

  // Linescore from the summary (goals) and events (shots on goal) per period.
  const periods = [...new Set([...(game.summary?.goals ?? []).map((x) => x.period), ...events.map((e) => e.period), 1, 2, 3])].filter((p) => p >= 1).sort((a, b) => a - b);
  const periodType = (p: number) => events.find((e) => e.period === p)?.periodType ?? game.summary?.goals.find((x) => x.period === p)?.periodType ?? (p > 3 ? "OT" : "REG");
  const goalsIn = (teamAbbrev: string, p: number) => (game.summary?.goals ?? []).filter((x) => x.period === p && x.teamAbbrev === teamAbbrev).length;
  const sogIn = (teamId: number, p: number) => events.filter((e) => e.period === p && e.teamId === teamId && (e.typeDescKey === "shot-on-goal" || e.typeDescKey === "goal")).length;

  const home = teamTotals(game.homeTeamId, skaters, events);
  const away = teamTotals(game.awayTeamId, skaters, events);
  const names = new Map(skaters.map((s) => [s.playerId, s.name] as [number, string]));
  for (const gl of goalies) names.set(gl.playerId, gl.name);

  // Season series, for the header.
  const seriesGames = featuredIn ? (await getTeamGames(TEAM_ID)).filter((x) => x.gameType === 2 && (x.homeTeamId === (game.homeTeamId === TEAM_ID ? game.awayTeamId : game.homeTeamId) || x.awayTeamId === (game.homeTeamId === TEAM_ID ? game.awayTeamId : game.homeTeamId))) : [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        <Link href={`/scores?date=${game.gameDate}`} className="hover:underline">
          ← Scores, {fmtYmdLong(game.gameDate)}
        </Link>
      </p>
      <Card>
        <LiveGameCard game={g} summary={game.summary ?? null} featuredId={featuredId} />
        <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
          {fmtDateTime(game.startTimeUtc)}
          {game.venue ? ` · ${game.venue}` : ""}
          {game.gameType === 1 ? " · Preseason" : game.gameType === 3 ? " · Playoffs" : ""}
          {status === "final" ? ` · Final${finalSuffix(game.lastPeriodType)}` : ""}
        </p>
      </Card>

      {status !== "pre" && (game.summary || events.length > 0) && (
        <Card title="Linescore">
          <table className="data w-auto text-sm">
            <thead>
              <tr>
                <th></th>
                {periods.map((p) => (
                  <th key={p} className="r">
                    {periodLabel(p, periodType(p))}
                  </th>
                ))}
                <th className="r">T</th>
              </tr>
            </thead>
            <tbody>
              {(["away", "home"] as const).map((side) => {
                const t = game[side];
                const total = side === "home" ? game.homeScore : game.awayScore;
                const sog = side === "home" ? game.homeSog : game.awaySog;
                return (
                  <tr key={side} className={t.id === featuredId && featuredIn ? "featured" : ""}>
                    <td>
                      <span className="inline-flex items-center gap-2">
                        <TeamLogo team={teamView(t)} size={20} /> {t.abbrev}
                      </span>
                    </td>
                    {periods.map((p) => (
                      <td key={p} className="r tabular">
                        {goalsIn(t.abbrev, p)}
                        {events.length > 0 && <span className="ml-1 text-[10px] text-muted">({sogIn(t.id, p)})</span>}
                      </td>
                    ))}
                    <td className="r font-semibold tabular">
                      {total}
                      {sog != null && <span className="ml-1 text-[10px] font-normal text-muted">({sog})</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {events.length > 0 && <p className="mt-1 text-[11px] text-muted">Goals, with shots on goal in parentheses.</p>}
        </Card>
      )}

      {loaded ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Shot map" className="lg:col-span-2">
              <ShotMap shots={events} featuredId={featuredId} names={names} />
              <ShotMapLegend featuredName={featuredIn ? (game.homeTeamId === TEAM_ID ? game.home : game.away).commonName : game.home.commonName} opponentName={(featuredIn ? (game.homeTeamId === TEAM_ID ? game.away : game.home) : game.away).commonName} />
            </Card>
            <Card title="Team stats">
              <table className="data w-full text-sm">
                <thead>
                  <tr>
                    <th>{game.away.abbrev}</th>
                    <th className="text-center"></th>
                    <th className="r">{game.home.abbrev}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Shots on goal", game.awaySog, game.homeSog],
                    ["Shot attempts", away.attempts, home.attempts],
                    ["Power play", `${away.ppGoals}/${away.ppOpps}`, `${home.ppGoals}/${home.ppOpps}`],
                    ["Penalty minutes", away.pim, home.pim],
                    ["Faceoff %", away.faceoffPct == null ? "—" : num(away.faceoffPct, 1), home.faceoffPct == null ? "—" : num(home.faceoffPct, 1)],
                    ["Hits", away.hits, home.hits],
                    ["Blocked shots", away.blocks, home.blocks],
                    ["Giveaways", away.giveaways, home.giveaways],
                    ["Takeaways", away.takeaways, home.takeaways],
                  ].map(([label, a, h]) => (
                    <tr key={String(label)}>
                      <td className="tabular">{a ?? "—"}</td>
                      <td className="text-center text-xs text-muted">{label}</td>
                      <td className="r tabular">{h ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {game.summary && game.summary.penalties.length > 0 && (
            <Card title="Penalties">
              <ul className="divide-y divide-line text-sm">
                {game.summary.penalties.map((p, i) => (
                  <li key={i} className="flex items-baseline gap-3 py-1.5">
                    <span className="w-16 shrink-0 text-xs text-muted tabular">
                      {periodLabel(p.period, p.periodType)} {p.timeInPeriod}
                    </span>
                    <span className="w-10 shrink-0 text-xs font-semibold">{p.teamAbbrev}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {p.committedBy ?? "Bench"} <span className="text-muted">· {p.descKey.replace(/-/g, " ")}</span>
                      {p.drawnBy && <span className="text-xs text-muted"> (drawn by {p.drawnBy})</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted tabular">
                      {p.duration ?? ""} {p.type}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={`${game.away.name} skaters`}>
            <SkaterTable rows={skaters.filter((s) => s.teamId === game.awayTeamId)} team={game.away} />
          </Card>
          <Card title={`${game.home.name} skaters`}>
            <SkaterTable rows={skaters.filter((s) => s.teamId === game.homeTeamId)} team={game.home} />
          </Card>
          <Card title="Goalies">
            <GoalieTable rows={goalies} />
          </Card>
        </>
      ) : status === "final" ? (
        <Card>
          <Empty>{featuredIn ? "Box score not loaded yet. It arrives with the next ingest." : "Box scores are stored for Sharks games only."}</Empty>
        </Card>
      ) : null}

      {seriesGames.length > 1 && (
        <Card title="Season series">
          <ul className="divide-y divide-line text-sm">
            {seriesGames.map((x) => {
              const isHome = x.homeTeamId === TEAM_ID;
              const mine = isHome ? x.homeScore : x.awayScore;
              const theirs = isHome ? x.awayScore : x.homeScore;
              const done = statusOf(x.gameState) === "final";
              return (
                <li key={x.id} className={`flex items-center justify-between py-1.5 ${x.id === game.id ? "font-semibold" : ""}`}>
                  <Link href={`/games/${x.id}`} className="hover:underline">
                    {fmtYmdLong(x.gameDate)} · {isHome ? "home" : "away"}
                  </Link>
                  <span className="tabular">{done ? `${mine! > theirs! ? "W" : "L"} ${mine}-${theirs}${finalSuffix(x.lastPeriodType)}` : "upcoming"}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
