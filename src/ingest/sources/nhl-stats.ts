/**
 * NHL stats REST API (api.nhle.com/stats/rest). League-wide season tables with a Cayenne
 * filter expression; `limit=-1` returns every row.
 */
import { z } from "zod";
import { fetchJson } from "../http";
import { SEASON, TEAM_ID } from "@/lib/season";

export const NHL_STATS_BASE = (process.env.NHL_STATS_BASE ?? "https://api.nhle.com/stats/rest/en").replace(/\/$/, "");

const envelope = <T extends z.ZodTypeAny>(row: T) => z.object({ total: z.number().optional(), data: z.array(row) });

const n = z.number().nullable().optional();

export const skaterSummaryRow = z.object({
  playerId: z.number(),
  skaterFullName: z.string(),
  lastName: z.string().optional(),
  teamAbbrevs: z.string().optional(),
  positionCode: z.string().optional(),
  shootsCatches: z.string().optional(),
  seasonId: z.number().optional(),
  gamesPlayed: n,
  goals: n,
  assists: n,
  points: n,
  plusMinus: n,
  penaltyMinutes: n,
  ppGoals: n,
  ppPoints: n,
  shGoals: n,
  shPoints: n,
  evGoals: n,
  evPoints: n,
  gameWinningGoals: n,
  otGoals: n,
  shots: n,
  shootingPct: n,
  timeOnIcePerGame: n,
  faceoffWinPct: n,
  pointsPerGame: n,
});
export type SkaterSummaryRow = z.infer<typeof skaterSummaryRow>;

export const goalieSummaryRow = z.object({
  playerId: z.number(),
  goalieFullName: z.string(),
  lastName: z.string().optional(),
  teamAbbrevs: z.string().optional(),
  shootsCatches: z.string().optional(),
  seasonId: z.number().optional(),
  gamesPlayed: n,
  gamesStarted: n,
  wins: n,
  losses: n,
  otLosses: n,
  shotsAgainst: n,
  saves: n,
  goalsAgainst: n,
  goalsAgainstAverage: n,
  savePct: n,
  shutouts: n,
  timeOnIce: n,
  assists: n,
  goals: n,
  penaltyMinutes: n,
});
export type GoalieSummaryRow = z.infer<typeof goalieSummaryRow>;

export const teamSummaryRow = z.object({
  teamId: z.number(),
  teamFullName: z.string(),
  seasonId: z.number().optional(),
  gameId: z.number().optional(),
  gameDate: z.string().optional(),
  opponentTeamAbbrev: z.string().optional(),
  homeRoad: z.string().optional(),
  gamesPlayed: n,
  wins: n,
  losses: n,
  otLosses: n,
  points: n,
  pointPct: n,
  goalsFor: n,
  goalsAgainst: n,
  goalsForPerGame: n,
  goalsAgainstPerGame: n,
  powerPlayPct: n,
  penaltyKillPct: n,
  powerPlayNetPct: n,
  penaltyKillNetPct: n,
  shotsForPerGame: n,
  shotsAgainstPerGame: n,
  faceoffWinPct: n,
  regulationAndOtWins: n,
  winsInRegulation: n,
  winsInShootout: n,
  teamShutouts: n,
});
export type TeamSummaryRow = z.infer<typeof teamSummaryRow>;

export const seasonRow = z.object({
  id: z.number(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  regularSeasonEndDate: z.string().optional(),
  numberOfGames: z.number().optional(),
});

export const skaterSummarySchema = envelope(skaterSummaryRow);
export const goalieSummarySchema = envelope(goalieSummaryRow);
export const teamSummarySchema = envelope(teamSummaryRow);
export const seasonSchema = envelope(seasonRow);

function q(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export async function fetchSkaterSummary(season = SEASON, gameType = 2) {
  return skaterSummarySchema.parse(
    await fetchJson(`${NHL_STATS_BASE}/skater/summary?${q({ limit: -1, cayenneExp: `seasonId=${season} and gameTypeId=${gameType}` })}`),
  );
}

export async function fetchGoalieSummary(season = SEASON, gameType = 2) {
  return goalieSummarySchema.parse(
    await fetchJson(`${NHL_STATS_BASE}/goalie/summary?${q({ limit: -1, cayenneExp: `seasonId=${season} and gameTypeId=${gameType}` })}`),
  );
}

export async function fetchTeamSummary(season = SEASON, gameType = 2) {
  return teamSummarySchema.parse(
    await fetchJson(`${NHL_STATS_BASE}/team/summary?${q({ limit: -1, cayenneExp: `seasonId=${season} and gameTypeId=${gameType}` })}`),
  );
}

/** One row per game for a team. */
export async function fetchTeamGameLog(teamId = TEAM_ID, season = SEASON, gameType = 2) {
  return teamSummarySchema.parse(
    await fetchJson(
      `${NHL_STATS_BASE}/team/summary?${q({ isGame: "true", limit: -1, cayenneExp: `seasonId=${season} and gameTypeId=${gameType} and teamId=${teamId}` })}`,
    ),
  );
}

export async function fetchSeasons() {
  return seasonSchema.parse(await fetchJson(`${NHL_STATS_BASE}/season?sort=id&dir=DESC&limit=5`));
}
