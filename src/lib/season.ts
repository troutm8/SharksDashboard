/** The 2026-27 NHL season, as the NHL APIs identify it. */
export const SEASON = 20262027;
/** MoneyPuck keys seasons by their starting year. */
export const SEASON_START_YEAR = 2026;
/** Opening night; standings snapshots are backfilled from here. */
export const SEASON_START = "2026-09-29";
/** Last day of the regular season. */
export const REGULAR_SEASON_END = "2027-04-10";
/** Latest possible date of the Stanley Cup Final; the backfill stops here. */
export const SEASON_END = "2027-06-30";

/** San Jose Sharks in the NHL APIs. */
export const TEAM_ID = Number(process.env.FEATURED_TEAM_ID ?? 28);
export const TEAM_ABBREV = process.env.FEATURED_TEAM_ABBREV ?? "SJS";

/** NHL game types. Preseason is ingested but hidden by default. */
export const GAME_TYPE = { preseason: 1, regular: 2, playoffs: 3 } as const;

export const MILESTONES: { date: string; label: string }[] = [
  { date: "2026-11-12", label: "Global Series, Helsinki" },
  { date: "2026-12-18", label: "Global Series, Düsseldorf" },
  { date: "2026-12-31", label: "Winter Classic, Salt Lake City" },
  { date: "2027-02-05", label: "All-Star Weekend, UBS Arena" },
  { date: "2027-02-20", label: "Stadium Series, Dallas" },
  { date: "2027-03-01", label: "Trade deadline, 3 p.m. ET" },
  { date: "2027-04-10", label: "Regular season ends, Sharks host Anaheim" },
];

/** Game states the NHL uses, collapsed to three. */
export type GameStatus = "pre" | "live" | "final";
export function statusOf(gameState: string): GameStatus {
  if (gameState === "LIVE" || gameState === "CRIT") return "live";
  if (gameState === "FINAL" || gameState === "OFF") return "final";
  return "pre";
}

const PT = "America/Los_Angeles";

/** YYYY-MM-DD for an instant in a time zone. */
export function ymdIn(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * "Today" for the dashboard is the Pacific calendar date. The NHL files each game under
 * the Eastern date of its start, and a 7 p.m. Pacific puck drop is 10 p.m. Eastern the
 * same day, so the two agree for Sharks home games; a game that runs past 9 p.m. Pacific
 * still belongs to the Pacific date it started on.
 */
export function todayPacific(): string {
  return ymdIn(new Date(), PT);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function* dateRange(from: string, to: string): Generator<string> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

export function isValidYmd(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

/** "2026-27" for display. */
export function seasonLabel(season = SEASON): string {
  const s = String(season);
  return `${s.slice(0, 4)}-${s.slice(6, 8)}`;
}
