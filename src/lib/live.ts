/** Shapes served by /api/live and merged into server-rendered views on the client. Pure; tested. */
import type { GameSummary } from "@/db/schema";
import { statusOf, type GameStatus } from "./season";
import type { GameView } from "./views";

export type LiveGame = {
  id: number;
  gameState: string;
  status: GameStatus;
  period: number | null;
  periodType: string | null;
  clock: string | null;
  inIntermission: boolean | null;
  homeScore: number | null;
  awayScore: number | null;
  homeSog: number | null;
  awaySog: number | null;
  lastPeriodType: string | null;
};

export type LiveDay = { fetchedAt: string; date: string; games: LiveGame[] };
export type LiveGameDetail = { fetchedAt: string; game: LiveGame; summary: GameSummary };

export function liveFromScore(g: {
  id: number;
  gameState: string;
  period?: number | null;
  periodDescriptor?: { number?: number; periodType?: string } | null;
  clock?: { timeRemaining?: string; inIntermission?: boolean } | null;
  homeTeam: { score?: number | null; sog?: number | null };
  awayTeam: { score?: number | null; sog?: number | null };
  gameOutcome?: { lastPeriodType?: string } | null;
}): LiveGame {
  const status = statusOf(g.gameState);
  return {
    id: g.id,
    gameState: g.gameState,
    status,
    period: status === "pre" ? null : (g.periodDescriptor?.number ?? g.period ?? null),
    periodType: status === "pre" ? null : (g.periodDescriptor?.periodType ?? null),
    clock: status === "live" ? (g.clock?.timeRemaining ?? null) : null,
    inIntermission: status === "live" ? (g.clock?.inIntermission ?? null) : null,
    homeScore: g.homeTeam.score ?? null,
    awayScore: g.awayTeam.score ?? null,
    homeSog: g.homeTeam.sog ?? null,
    awaySog: g.awayTeam.sog ?? null,
    lastPeriodType: g.gameOutcome?.lastPeriodType ?? null,
  };
}

export function mergeLive(g: GameView, live: LiveGame): GameView {
  return {
    ...g,
    gameState: live.gameState,
    status: live.status,
    period: live.period ?? g.period,
    periodType: live.periodType ?? g.periodType,
    clock: live.clock,
    inIntermission: live.inIntermission,
    homeScore: live.homeScore ?? g.homeScore,
    awayScore: live.awayScore ?? g.awayScore,
    homeSog: live.homeSog ?? g.homeSog,
    awaySog: live.awaySog ?? g.awaySog,
    lastPeriodType: live.lastPeriodType ?? g.lastPeriodType,
  };
}

/** How often the client should ask again, in ms, or 0 to stop. */
export function pollInterval(games: { status: GameStatus; startTime: string | null }[], now = Date.now()): number {
  if (games.some((g) => g.status === "live")) return 20_000;
  const upcoming = games.filter((g) => g.status === "pre" && g.startTime);
  if (!upcoming.length) return 0;
  const soonest = Math.min(...upcoming.map((g) => Date.parse(g.startTime!)));
  // Within 15 minutes of a start, or past it (the feed flips to LIVE a little late), poll like a live game.
  if (soonest - now < 15 * 60_000) return 20_000;
  return 5 * 60_000;
}
