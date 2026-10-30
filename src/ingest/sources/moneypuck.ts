/**
 * MoneyPuck public CSVs: playoff odds and expected-goals data. Refreshed daily upstream.
 * Attribute MoneyPuck wherever these numbers appear.
 */
import { z } from "zod";
import { fetchCsv } from "../http";
import { SEASON_START_YEAR } from "@/lib/season";

export const MONEYPUCK_BASE = (process.env.MONEYPUCK_BASE ?? "https://moneypuck.com/moneypuck").replace(/\/$/, "");

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF. Duplicate headers keep the last value. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((r) => {
    const o: Record<string, string> = {};
    header.forEach((h, i) => (o[h.trim()] = r[i] ?? ""));
    return o;
  });
}

const num = z.coerce.number();
const numOpt = z
  .string()
  .optional()
  .transform((s) => (s == null || s === "" || s === "NA" ? null : Number(s)))
  .pipe(z.number().nullable());

export const simulationRow = z.object({
  scenerio: z.string(), // sic, MoneyPuck's spelling
  teamCode: z.string(),
  madePlayoffs: num,
  round2: numOpt,
  round3: numOpt,
  round4: numOpt,
  wonCup: numOpt,
  firstOverall: numOpt,
  points: numOpt,
  wonDivision: numOpt,
  draftLottery: numOpt,
  wildcard1Odds: numOpt,
  wildcard2Odds: numOpt,
});
export type SimulationRow = z.infer<typeof simulationRow>;

export const teamRow = z.object({
  team: z.string(),
  season: num,
  situation: z.string(),
  games_played: num,
  iceTime: numOpt,
  xGoalsPercentage: numOpt,
  corsiPercentage: numOpt,
  fenwickPercentage: numOpt,
  xGoalsFor: numOpt,
  xGoalsAgainst: numOpt,
  goalsFor: numOpt,
  goalsAgainst: numOpt,
  shotsOnGoalFor: numOpt,
  shotsOnGoalAgainst: numOpt,
  shotAttemptsFor: numOpt,
  shotAttemptsAgainst: numOpt,
  highDangerxGoalsFor: numOpt,
  highDangerxGoalsAgainst: numOpt,
  highDangerGoalsFor: numOpt,
  highDangerGoalsAgainst: numOpt,
});
export type MoneyPuckTeamRow = z.infer<typeof teamRow>;

export const skaterRow = z.object({
  playerId: num,
  season: num,
  name: z.string(),
  team: z.string(),
  position: z.string(),
  situation: z.string(),
  games_played: num,
  icetime: numOpt,
  gameScore: numOpt,
  onIce_xGoalsPercentage: numOpt,
  offIce_xGoalsPercentage: numOpt,
  onIce_corsiPercentage: numOpt,
  I_F_xGoals: numOpt,
  I_F_goals: numOpt,
  I_F_primaryAssists: numOpt,
  I_F_secondaryAssists: numOpt,
  I_F_points: numOpt,
  I_F_shotsOnGoal: numOpt,
  I_F_highDangerxGoals: numOpt,
  I_F_hits: numOpt,
  I_F_takeaways: numOpt,
  I_F_giveaways: numOpt,
  shotsBlockedByPlayer: numOpt,
  OnIce_F_xGoals: numOpt,
  OnIce_A_xGoals: numOpt,
});
export type MoneyPuckSkaterRow = z.infer<typeof skaterRow>;

/** MoneyPuck team codes that differ from the NHL tricode. Empty this season; kept as the hand-fix hook. */
export const TEAM_CODE_OVERRIDES: Record<string, string> = {
  "S.J": "SJS",
  "L.A": "LAK",
  "N.J": "NJD",
  "T.B": "TBL",
};
export function nhlAbbrevOf(code: string): string {
  return TEAM_CODE_OVERRIDES[code] ?? code;
}

export function parseSimulations(csv: string): SimulationRow[] {
  return parseCsv(csv).map((r) => simulationRow.parse(r));
}
export function parseTeams(csv: string): MoneyPuckTeamRow[] {
  return parseCsv(csv).map((r) => teamRow.parse(r));
}
export function parseSkaters(csv: string): MoneyPuckSkaterRow[] {
  return parseCsv(csv).map((r) => skaterRow.parse(r));
}

export async function fetchSimulations() {
  return parseSimulations(await fetchCsv(`${MONEYPUCK_BASE}/simulations/simulations_recent.csv`));
}
export async function fetchTeams(startYear = SEASON_START_YEAR) {
  return parseTeams(await fetchCsv(`${MONEYPUCK_BASE}/playerData/seasonSummary/${startYear}/regular/teams.csv`));
}
export async function fetchSkaters(startYear = SEASON_START_YEAR) {
  return parseSkaters(await fetchCsv(`${MONEYPUCK_BASE}/playerData/seasonSummary/${startYear}/regular/skaters.csv`));
}
