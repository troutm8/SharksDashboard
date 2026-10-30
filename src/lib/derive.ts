/**
 * Pure derivations over stored rows: records, streaks, splits, season series, pace, the
 * wild-card picture. No database access here; everything is unit-tested on plain objects.
 */
import type { Game, StandingsRow, Team } from "@/db/schema";

export type Outcome = "W" | "L" | "OTL";

/** Only games that count: finished regular-season games (or a given type). */
export function finishedGames(games: Game[], gameType = 2): Game[] {
  return games.filter((g) => g.gameType === gameType && (g.gameState === "FINAL" || g.gameState === "OFF") && g.homeScore != null && g.awayScore != null);
}

export function outcomeFor(teamId: number, g: Game): Outcome | null {
  if (g.homeScore == null || g.awayScore == null) return null;
  const isHome = g.homeTeamId === teamId;
  const mine = isHome ? g.homeScore : g.awayScore;
  const theirs = isHome ? g.awayScore : g.homeScore;
  if (mine > theirs) return "W";
  return g.lastPeriodType === "OT" || g.lastPeriodType === "SO" ? "OTL" : "L";
}

export type Split = { w: number; l: number; otl: number };
const split = (): Split => ({ w: 0, l: 0, otl: 0 });
function tally(s: Split, o: Outcome) {
  if (o === "W") s.w++;
  else if (o === "L") s.l++;
  else s.otl++;
}
export function splitText(s: Split): string {
  return `${s.w}-${s.l}-${s.otl}`;
}
export function splitPoints(s: Split): number {
  return s.w * 2 + s.otl;
}

export type TeamRecord = {
  gp: number;
  w: number;
  l: number;
  otl: number;
  points: number;
  pointPct: number;
  gf: number;
  ga: number;
  diff: number;
  home: Split;
  road: Split;
  oneGoal: Split;
  overtime: Split;
  vsDivision: Split;
  vsConference: Split;
  byMonth: { month: string; split: Split }[];
  last10: Outcome[];
  streak: string;
  regulationWins: number;
  results: Outcome[];
};

/** A team's record from its finished games in chronological order. `teams` supplies division and conference for the splits. */
export function computeRecord(teamId: number, games: Game[], teams: Map<number, Pick<Team, "division" | "conference">> = new Map()): TeamRecord {
  const r: TeamRecord = {
    gp: 0,
    w: 0,
    l: 0,
    otl: 0,
    points: 0,
    pointPct: 0,
    gf: 0,
    ga: 0,
    diff: 0,
    home: split(),
    road: split(),
    oneGoal: split(),
    overtime: split(),
    vsDivision: split(),
    vsConference: split(),
    byMonth: [],
    last10: [],
    streak: "—",
    regulationWins: 0,
    results: [],
  };
  const me = teams.get(teamId);
  const months = new Map<string, Split>();
  for (const g of finishedGames(games)) {
    const o = outcomeFor(teamId, g);
    if (!o) continue;
    const isHome = g.homeTeamId === teamId;
    const mine = isHome ? g.homeScore! : g.awayScore!;
    const theirs = isHome ? g.awayScore! : g.homeScore!;
    r.gp++;
    r.gf += mine;
    r.ga += theirs;
    r.results.push(o);
    if (o === "W") r.w++;
    else if (o === "L") r.l++;
    else r.otl++;
    if (o === "W" && (g.lastPeriodType ?? "REG") === "REG") r.regulationWins++;
    tally(isHome ? r.home : r.road, o);
    if (Math.abs(mine - theirs) === 1) tally(r.oneGoal, o);
    if (g.lastPeriodType === "OT" || g.lastPeriodType === "SO") tally(r.overtime, o);
    const opp = teams.get(isHome ? g.awayTeamId : g.homeTeamId);
    if (me && opp) {
      if (me.division && me.division === opp.division) tally(r.vsDivision, o);
      if (me.conference && me.conference === opp.conference) tally(r.vsConference, o);
    }
    const month = g.gameDate.slice(0, 7);
    if (!months.has(month)) months.set(month, split());
    tally(months.get(month)!, o);
  }
  r.points = r.w * 2 + r.otl;
  r.pointPct = r.gp ? r.points / (r.gp * 2) : 0;
  r.diff = r.gf - r.ga;
  r.last10 = r.results.slice(-10);
  r.byMonth = [...months.entries()].map(([month, s]) => ({ month, split: s }));
  if (r.results.length) {
    const last = r.results[r.results.length - 1];
    let n = 0;
    for (let i = r.results.length - 1; i >= 0 && r.results[i] === last; i--) n++;
    r.streak = `${last === "OTL" ? "OTL" : last}${n}`;
  }
  return r;
}

export function recordText(r: { w: number; l: number; otl: number }): string {
  return `${r.w}-${r.l}-${r.otl}`;
}

/** Head-to-head this season, from the featured team's point of view. */
export function seasonSeries(teamId: number, oppId: number, games: Game[]): { split: Split; games: Game[] } {
  const gs = finishedGames(games).filter((g) => (g.homeTeamId === teamId && g.awayTeamId === oppId) || (g.homeTeamId === oppId && g.awayTeamId === teamId));
  const s = split();
  for (const g of gs) {
    const o = outcomeFor(teamId, g);
    if (o) tally(s, o);
  }
  return { split: s, games: gs };
}

/** Points pace over a full season. */
export function pointsPace(points: number, gp: number, totalGames = 84): number {
  return gp ? Math.round((points / gp) * totalGames) : 0;
}

export type PlayoffPicture = {
  conference: string;
  /** The eight current playoff teams in bracket order: division winners' top three each, then wild cards. */
  inside: StandingsRow[];
  /** Everyone else in the conference, in wild-card order. */
  outside: StandingsRow[];
  /** The second wild card: the line to beat. */
  cutLine: StandingsRow | null;
  /** For the featured team: points relative to the line (positive is above) and games in hand (positive means fewer played). */
  featured: { row: StandingsRow; pointsVsLine: number; gamesInHand: number; inPlayoffs: boolean; slot: string } | null;
};

/**
 * The wild-card view of one conference from a standings snapshot. The NHL marks the top
 * three in each division with wildcardSequence 0 and orders the rest by points percentage
 * and tiebreakers, so the picture is a sort, not a recomputation.
 */
export function playoffPicture(rows: StandingsRow[], teams: Map<number, Team>, conference: string, featuredId: number): PlayoffPicture {
  const conf = rows.filter((r) => teams.get(r.teamId)?.conference === conference);
  const byDiv = new Map<string, StandingsRow[]>();
  for (const r of conf) {
    const d = teams.get(r.teamId)?.division ?? "?";
    byDiv.set(d, [...(byDiv.get(d) ?? []), r]);
  }
  const inside: StandingsRow[] = [];
  for (const [, members] of [...byDiv.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    inside.push(...members.filter((r) => (r.wildcardSequence ?? 99) === 0).sort((a, b) => (a.divisionSequence ?? 99) - (b.divisionSequence ?? 99)));
  }
  const wild = conf.filter((r) => (r.wildcardSequence ?? 0) > 0).sort((a, b) => (a.wildcardSequence ?? 99) - (b.wildcardSequence ?? 99));
  inside.push(...wild.slice(0, 2));
  const outside = wild.slice(2);
  const cutLine = wild[1] ?? null;
  const row = conf.find((r) => r.teamId === featuredId) ?? null;
  let featured: PlayoffPicture["featured"] = null;
  if (row) {
    const inPlayoffs = inside.some((r) => r.teamId === featuredId);
    const ref = inPlayoffs ? outside[0] ?? null : cutLine;
    const slot =
      (row.wildcardSequence ?? 0) === 0
        ? `${ordinalWord(row.divisionSequence ?? 0)} in the ${teams.get(row.teamId)?.division ?? ""}`
        : row.wildcardSequence === 1
          ? "First wild card"
          : row.wildcardSequence === 2
            ? "Second wild card"
            : `${ordinalWord((row.wildcardSequence ?? 3) - 2)} out of the wild card`;
    featured = {
      row,
      pointsVsLine: ref ? row.points - ref.points : 0,
      gamesInHand: ref ? ref.gamesPlayed - row.gamesPlayed : 0,
      inPlayoffs,
      slot,
    };
  }
  return { conference, inside, outside, cutLine, featured };
}

function ordinalWord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Group a league standings snapshot by division (or conference), sorted by the NHL's own sequence. */
export function groupStandings(rows: StandingsRow[], teams: Map<number, Team>, by: "division" | "conference"): { name: string; rows: StandingsRow[] }[] {
  const groups = new Map<string, StandingsRow[]>();
  for (const r of rows) {
    const key = teams.get(r.teamId)?.[by] ?? "?";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const seq = by === "division" ? (r: StandingsRow) => r.divisionSequence ?? 99 : (r: StandingsRow) => r.conferenceSequence ?? 99;
  return [...groups.entries()]
    .map(([name, rs]) => ({ name, rows: rs.sort((a, b) => seq(a) - seq(b)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Power rating out of 100, from four published components. Deliberately simple so it can be
 * argued with on the /rankings page; nothing here is an NHL product.
 */
export const POWER_WEIGHTS = { points: 40, goalDiff: 20, xg: 25, form: 15 } as const;

export type PowerInput = {
  teamId: number;
  gamesPlayed: number;
  pointPct: number;
  goalDifferential: number;
  /** 5-on-5 expected-goals share from MoneyPuck, 0..1, or null when unavailable. */
  xgPct: number | null;
  l10Points: number;
  l10Games: number;
};

export type PowerRating = {
  teamId: number;
  score: number;
  components: { points: number; goalDiff: number; xg: number; form: number };
  rank: number;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function powerRating(t: PowerInput): Omit<PowerRating, "rank"> {
  const gdPerGame = t.gamesPlayed ? t.goalDifferential / t.gamesPlayed : 0;
  const components = {
    points: POWER_WEIGHTS.points * clamp01(t.pointPct),
    // A goal differential of +1.5 per game is elite, -1.5 is dreadful.
    goalDiff: POWER_WEIGHTS.goalDiff * clamp01((gdPerGame + 1.5) / 3),
    // 5-on-5 xG share between 40% and 60% covers the whole league in a normal season.
    // Without MoneyPuck the component is neutral rather than zero.
    xg: t.xgPct == null ? POWER_WEIGHTS.xg / 2 : POWER_WEIGHTS.xg * clamp01((t.xgPct - 0.4) / 0.2),
    form: POWER_WEIGHTS.form * (t.l10Games ? clamp01(t.l10Points / (t.l10Games * 2)) : 0.5),
  };
  return { teamId: t.teamId, score: components.points + components.goalDiff + components.xg + components.form, components };
}

export function powerRankings(inputs: PowerInput[]): PowerRating[] {
  return inputs
    .map(powerRating)
    .sort((a, b) => b.score - a.score || a.teamId - b.teamId)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Rank of a value among all values (1 = best). `higherIsBetter` false for goals against and the like. */
export function rankOf(value: number | null, all: (number | null)[], higherIsBetter = true): number | null {
  if (value == null) return null;
  const vals = all.filter((v): v is number => v != null);
  const better = vals.filter((v) => (higherIsBetter ? v > value : v < value)).length;
  return better + 1;
}
