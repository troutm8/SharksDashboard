/**
 * NHL web API (api-web.nhle.com), the feed NHL.com itself renders from. Undocumented.
 *
 * Schemas are deliberately permissive: Zod strips unknown keys, and every field we do not
 * render is optional, so an upstream addition never breaks ingestion while a removal of a
 * field we rely on fails loudly here rather than silently in the UI.
 */
import { z } from "zod";
import { fetchJson } from "../http";
import { SEASON, TEAM_ABBREV, ymdIn } from "@/lib/season";

export const NHL_WEB_BASE = (process.env.NHL_WEB_BASE ?? "https://api-web.nhle.com/v1").replace(/\/$/, "");

/** Strings the NHL localizes come as {default, fr, ...}. */
const localized = z.object({ default: z.string() });
const localizedOpt = localized.optional().nullable();
const localizedString = z.union([localized, z.string()]).transform((v) => (typeof v === "string" ? v : v.default));

export const periodDescriptor = z
  .object({
    number: z.number().optional(),
    periodType: z.string().optional(),
    maxRegulationPeriods: z.number().optional(),
  })
  .nullable()
  .optional();

export const broadcast = z.object({
  id: z.number().optional(),
  market: z.string().optional().default(""),
  countryCode: z.string().optional().default(""),
  network: z.string(),
});

/** A team as it appears on schedule, score and game-center payloads; field names vary by endpoint. */
export const gameTeam = z.object({
  id: z.number(),
  abbrev: z.string(),
  commonName: localizedOpt,
  placeName: localizedOpt,
  name: localizedOpt,
  logo: z.string().optional(),
  darkLogo: z.string().optional(),
  score: z.number().nullable().optional(),
  sog: z.number().nullable().optional(),
  record: z.string().optional(),
});

export const clock = z
  .object({
    timeRemaining: z.string().optional(),
    secondsRemaining: z.number().optional(),
    running: z.boolean().optional(),
    inIntermission: z.boolean().optional(),
  })
  .nullable()
  .optional();

/** One game, as listed by club-schedule-season, schedule/{date} and score/{date}. */
export const scheduleGame = z.object({
  id: z.number(),
  season: z.number(),
  gameType: z.number(),
  /** Present on the club schedule and the day scoreboard; absent on the week schedule, whose days carry the date. */
  gameDate: z.string().optional(),
  venue: localizedOpt,
  venueTimezone: z.string().optional(),
  neutralSite: z.boolean().optional(),
  startTimeUTC: z.string(),
  gameState: z.string(),
  gameScheduleState: z.string().optional(),
  tvBroadcasts: z.array(broadcast).optional(),
  awayTeam: gameTeam,
  homeTeam: gameTeam,
  periodDescriptor,
  period: z.number().nullable().optional(),
  clock,
  gameOutcome: z.object({ lastPeriodType: z.string().optional() }).nullable().optional(),
});
export type ScheduleGame = z.infer<typeof scheduleGame>;

export const clubScheduleSchema = z.object({
  currentSeason: z.number(),
  clubTimezone: z.string().optional(),
  games: z.array(scheduleGame),
});

export const scoreDaySchema = z.object({
  prevDate: z.string().optional(),
  currentDate: z.string(),
  nextDate: z.string().optional(),
  games: z.array(scheduleGame),
});

export const scheduleWeekSchema = z.object({
  nextStartDate: z.string().optional(),
  previousStartDate: z.string().optional(),
  regularSeasonStartDate: z.string().optional(),
  regularSeasonEndDate: z.string().optional(),
  gameWeek: z.array(z.object({ date: z.string(), numberOfGames: z.number().optional(), games: z.array(scheduleGame) })),
});

export const standingsRow = z.object({
  date: z.string().optional(),
  seasonId: z.number().optional(),
  teamAbbrev: localized,
  teamName: localized,
  teamCommonName: localized,
  placeName: localized,
  teamLogo: z.string().optional(),
  teamLogoDark: z.string().optional(),
  conferenceName: z.string().optional(),
  conferenceAbbrev: z.string().optional(),
  divisionName: z.string().optional(),
  divisionAbbrev: z.string().optional(),
  gamesPlayed: z.number(),
  wins: z.number(),
  losses: z.number(),
  otLosses: z.number(),
  points: z.number(),
  pointPctg: z.number().optional(),
  regulationWins: z.number().optional(),
  regulationPlusOtWins: z.number().optional(),
  goalFor: z.number().optional(),
  goalAgainst: z.number().optional(),
  goalDifferential: z.number().optional(),
  homeWins: z.number().optional(),
  homeLosses: z.number().optional(),
  homeOtLosses: z.number().optional(),
  roadWins: z.number().optional(),
  roadLosses: z.number().optional(),
  roadOtLosses: z.number().optional(),
  l10Wins: z.number().optional(),
  l10Losses: z.number().optional(),
  l10OtLosses: z.number().optional(),
  streakCode: z.string().optional(),
  streakCount: z.number().optional(),
  shootoutWins: z.number().optional(),
  shootoutLosses: z.number().optional(),
  divisionSequence: z.number().optional(),
  conferenceSequence: z.number().optional(),
  leagueSequence: z.number().optional(),
  wildcardSequence: z.number().optional(),
});
export type StandingsRowRaw = z.infer<typeof standingsRow>;

export const standingsSchema = z.object({ wildCardIndicator: z.boolean().optional(), standings: z.array(standingsRow) });

export const rosterPlayer = z.object({
  id: z.number(),
  headshot: z.string().optional(),
  firstName: localized,
  lastName: localized,
  sweaterNumber: z.number().optional(),
  positionCode: z.string(),
  shootsCatches: z.string().optional(),
  heightInInches: z.number().optional(),
  weightInPounds: z.number().optional(),
  birthDate: z.string().optional(),
  birthCity: localizedOpt,
  birthCountry: z.string().optional(),
});
export const rosterSchema = z.object({ forwards: z.array(rosterPlayer), defensemen: z.array(rosterPlayer), goalies: z.array(rosterPlayer) });

export const boxscoreSkater = z.object({
  playerId: z.number(),
  sweaterNumber: z.number().optional(),
  name: localized,
  position: z.string(),
  goals: z.number().optional(),
  assists: z.number().optional(),
  points: z.number().optional(),
  plusMinus: z.number().optional(),
  pim: z.number().optional(),
  hits: z.number().optional(),
  powerPlayGoals: z.number().optional(),
  sog: z.number().optional(),
  faceoffWinningPctg: z.number().optional(),
  toi: z.string().optional(),
  blockedShots: z.number().optional(),
  shifts: z.number().optional(),
  giveaways: z.number().optional(),
  takeaways: z.number().optional(),
});
export const boxscoreGoalie = z.object({
  playerId: z.number(),
  sweaterNumber: z.number().optional(),
  name: localized,
  position: z.string(),
  evenStrengthShotsAgainst: z.string().optional(),
  powerPlayShotsAgainst: z.string().optional(),
  shorthandedShotsAgainst: z.string().optional(),
  saveShotsAgainst: z.string().optional(),
  savePctg: z.number().optional(),
  evenStrengthGoalsAgainst: z.number().optional(),
  powerPlayGoalsAgainst: z.number().optional(),
  shorthandedGoalsAgainst: z.number().optional(),
  pim: z.number().optional(),
  goalsAgainst: z.number().optional(),
  toi: z.string().optional(),
  starter: z.boolean().optional(),
  decision: z.string().optional(),
  shotsAgainst: z.number().optional(),
  saves: z.number().optional(),
});
const boxscoreSide = z.object({ forwards: z.array(boxscoreSkater), defense: z.array(boxscoreSkater), goalies: z.array(boxscoreGoalie) });
export const boxscoreSchema = z.object({
  id: z.number(),
  gameState: z.string(),
  homeTeam: gameTeam,
  awayTeam: gameTeam,
  periodDescriptor,
  gameOutcome: z.object({ lastPeriodType: z.string().optional() }).nullable().optional(),
  playerByGameStats: z.object({ awayTeam: boxscoreSide, homeTeam: boxscoreSide }),
});
export type Boxscore = z.infer<typeof boxscoreSchema>;

const summaryGoal = z.object({
  situationCode: z.string().optional(),
  eventId: z.number().optional(),
  strength: z.string().optional(),
  playerId: z.number(),
  name: localized,
  firstName: localized.optional(),
  lastName: localized.optional(),
  teamAbbrev: localizedString,
  goalsToDate: z.number().optional(),
  awayScore: z.number(),
  homeScore: z.number(),
  timeInPeriod: z.string(),
  shotType: z.string().optional(),
  highlightClipSharingUrl: z.string().optional(),
  assists: z.array(z.object({ playerId: z.number(), name: localized, assistsToDate: z.number().optional() })).optional().default([]),
});
const summaryPenalty = z.object({
  timeInPeriod: z.string(),
  type: z.string(),
  duration: z.number().optional(),
  committedByPlayer: z.union([z.object({ firstName: localized, lastName: localized }), z.string()]).optional(),
  drawnBy: z.union([z.object({ firstName: localized, lastName: localized }), z.string()]).optional(),
  teamAbbrev: localizedString,
  descKey: z.string(),
});
const threeStar = z.object({
  star: z.number(),
  playerId: z.number(),
  teamAbbrev: z.string(),
  name: localized,
  sweaterNo: z.number().optional(),
  position: z.string(),
  goals: z.number().optional(),
  assists: z.number().optional(),
  points: z.number().optional(),
  savePctg: z.number().optional(),
  goalsAgainst: z.number().optional(),
});
export const landingSchema = z.object({
  id: z.number(),
  gameState: z.string(),
  homeTeam: gameTeam,
  awayTeam: gameTeam,
  periodDescriptor,
  clock,
  summary: z
    .object({
      scoring: z.array(z.object({ periodDescriptor, goals: z.array(summaryGoal) })).optional().default([]),
      penalties: z.array(z.object({ periodDescriptor, penalties: z.array(summaryPenalty) })).optional().default([]),
      threeStars: z.array(threeStar).optional().default([]),
    })
    .optional(),
});
export type Landing = z.infer<typeof landingSchema>;

export const pbpPlay = z.object({
  eventId: z.number(),
  periodDescriptor: z.object({ number: z.number(), periodType: z.string() }),
  timeInPeriod: z.string(),
  timeRemaining: z.string().optional(),
  situationCode: z.string().optional(),
  homeTeamDefendingSide: z.string().optional(),
  typeCode: z.number(),
  typeDescKey: z.string(),
  sortOrder: z.number(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export const rosterSpot = z.object({
  teamId: z.number(),
  playerId: z.number(),
  firstName: localized,
  lastName: localized,
  sweaterNumber: z.number().optional(),
  positionCode: z.string(),
  headshot: z.string().optional(),
});
export const playByPlaySchema = z.object({
  id: z.number(),
  gameState: z.string(),
  homeTeam: gameTeam,
  awayTeam: gameTeam,
  rosterSpots: z.array(rosterSpot).optional().default([]),
  plays: z.array(pbpPlay),
});
export type PlayByPlay = z.infer<typeof playByPlaySchema>;

export const clubStatsSchema = z.object({
  season: z.string().or(z.number()),
  gameType: z.number(),
  skaters: z.array(z.object({ playerId: z.number(), gamesPlayed: z.number().optional() }).loose()),
  goalies: z.array(z.object({ playerId: z.number(), gamesPlayed: z.number().optional() }).loose()),
});

const seasonTotal = z
  .object({
    season: z.number(),
    gameTypeId: z.number(),
    leagueAbbrev: z.string(),
    teamName: localized.optional(),
    gamesPlayed: z.number().optional(),
    goals: z.number().optional(),
    assists: z.number().optional(),
    points: z.number().optional(),
    plusMinus: z.number().optional(),
    pim: z.number().optional(),
    wins: z.number().optional(),
    losses: z.number().optional(),
    otLosses: z.number().optional(),
    goalsAgainstAvg: z.number().optional(),
    savePctg: z.number().optional(),
    shutouts: z.number().optional(),
  })
  .loose();
export const playerLandingSchema = z.object({
  playerId: z.number(),
  isActive: z.boolean().optional(),
  currentTeamId: z.number().optional(),
  currentTeamAbbrev: z.string().optional(),
  fullTeamName: localized.optional(),
  firstName: localized,
  lastName: localized,
  sweaterNumber: z.number().optional(),
  position: z.string(),
  headshot: z.string().optional(),
  heroImage: z.string().optional(),
  heightInInches: z.number().optional(),
  weightInPounds: z.number().optional(),
  birthDate: z.string().optional(),
  birthCity: localizedOpt,
  birthStateProvince: localizedOpt,
  birthCountry: z.string().optional(),
  shootsCatches: z.string().optional(),
  draftDetails: z.object({ year: z.number(), teamAbbrev: z.string(), round: z.number(), pickInRound: z.number(), overallPick: z.number() }).optional(),
  featuredStats: z
    .object({
      season: z.number().optional(),
      regularSeason: z.object({ subSeason: z.record(z.string(), z.unknown()).optional(), career: z.record(z.string(), z.unknown()).optional() }).optional(),
    })
    .optional(),
  careerTotals: z.object({ regularSeason: z.record(z.string(), z.unknown()).optional(), playoffs: z.record(z.string(), z.unknown()).optional() }).optional(),
  seasonTotals: z.array(seasonTotal).optional().default([]),
});
export type PlayerLanding = z.infer<typeof playerLandingSchema>;

export const playerGameLogSchema = z.object({
  seasonId: z.number().optional(),
  gameTypeId: z.number().optional(),
  gameLog: z.array(
    z
      .object({
        gameId: z.number(),
        gameDate: z.string(),
        teamAbbrev: z.string(),
        homeRoadFlag: z.string(),
        opponentAbbrev: z.string(),
        goals: z.number().optional(),
        assists: z.number().optional(),
        points: z.number().optional(),
        plusMinus: z.number().optional(),
        pim: z.number().optional(),
        shots: z.number().optional(),
        shifts: z.number().optional(),
        toi: z.string().optional(),
        powerPlayGoals: z.number().optional(),
        powerPlayPoints: z.number().optional(),
        shorthandedGoals: z.number().optional(),
        gameWinningGoals: z.number().optional(),
        otGoals: z.number().optional(),
        decision: z.string().optional(),
        shotsAgainst: z.number().optional(),
        goalsAgainst: z.number().optional(),
        savePctg: z.number().optional(),
        shutouts: z.number().optional(),
      })
      .loose(),
  ),
});

const leaderEntry = z.object({
  id: z.number(),
  firstName: localized,
  lastName: localized,
  sweaterNumber: z.number().optional(),
  headshot: z.string().optional(),
  teamAbbrev: z.string(),
  teamName: localized.optional(),
  teamLogo: z.string().optional(),
  position: z.string(),
  value: z.number(),
});
export const leadersSchema = z.record(z.string(), z.array(leaderEntry));
export type LeaderEntry = z.infer<typeof leaderEntry>;

// ----- fetchers -----------------------------------------------------------------------

export async function fetchClubSchedule(abbrev = TEAM_ABBREV, season: number | "now" = "now") {
  return clubScheduleSchema.parse(await fetchJson(`${NHL_WEB_BASE}/club-schedule-season/${abbrev}/${season}`));
}

export async function fetchScoreDay(ymd: string) {
  return scoreDaySchema.parse(await fetchJson(`${NHL_WEB_BASE}/score/${ymd}`));
}

/** Seven days of every team's games, starting at `ymd`. */
export async function fetchScheduleWeek(ymd: string) {
  return scheduleWeekSchema.parse(await fetchJson(`${NHL_WEB_BASE}/schedule/${ymd}`));
}

export async function fetchStandings(ymd: string | "now" = "now") {
  return standingsSchema.parse(await fetchJson(`${NHL_WEB_BASE}/standings/${ymd}`));
}

export async function fetchRoster(abbrev = TEAM_ABBREV, season: number | "current" = "current") {
  return rosterSchema.parse(await fetchJson(`${NHL_WEB_BASE}/roster/${abbrev}/${season}`));
}

export async function fetchBoxscore(gameId: number) {
  return boxscoreSchema.parse(await fetchJson(`${NHL_WEB_BASE}/gamecenter/${gameId}/boxscore`));
}

export async function fetchLanding(gameId: number) {
  return landingSchema.parse(await fetchJson(`${NHL_WEB_BASE}/gamecenter/${gameId}/landing`));
}

export async function fetchPlayByPlay(gameId: number) {
  return playByPlaySchema.parse(await fetchJson(`${NHL_WEB_BASE}/gamecenter/${gameId}/play-by-play`));
}

export async function fetchPlayerLanding(playerId: number) {
  return playerLandingSchema.parse(await fetchJson(`${NHL_WEB_BASE}/player/${playerId}/landing`));
}

export async function fetchPlayerGameLog(playerId: number, season = SEASON, gameType = 2) {
  return playerGameLogSchema.parse(await fetchJson(`${NHL_WEB_BASE}/player/${playerId}/game-log/${season}/${gameType}`));
}

export async function fetchSkaterLeaders(limit = 10) {
  return leadersSchema.parse(await fetchJson(`${NHL_WEB_BASE}/skater-stats-leaders/current?limit=${limit}`));
}

export async function fetchGoalieLeaders(limit = 10) {
  return leadersSchema.parse(await fetchJson(`${NHL_WEB_BASE}/goalie-stats-leaders/current?limit=${limit}`));
}

// ----- helpers ------------------------------------------------------------------------

/** The NHL's calendar date for a game: its own field, else the schedule day it sits under, else the Eastern date of the start. */
export function gameDateOf(g: { gameDate?: string; startTimeUTC: string }, dayDate?: string): string {
  if (g.gameDate) return g.gameDate;
  if (dayDate) return dayDate;
  return ymdIn(new Date(g.startTimeUTC), "America/New_York");
}

export function broadcastsOf(g: { tvBroadcasts?: z.infer<typeof broadcast>[] }) {
  return (g.tvBroadcasts ?? []).map((b) => ({ network: b.network, market: b.market, countryCode: b.countryCode }));
}

/** US national and home-market networks first, in the order the NHL lists them. */
export function usBroadcasts(bs: { network: string; market: string; countryCode: string }[]): string[] {
  const us = bs.filter((b) => b.countryCode === "US");
  const pick = us.length ? us : bs;
  return [...new Set(pick.map((b) => b.network))];
}
