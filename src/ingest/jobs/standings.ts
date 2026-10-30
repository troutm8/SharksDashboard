import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { standingsSnapshots } from "@/db/schema";
import { SEASON } from "@/lib/season";
import * as nhl from "../sources/nhl-web";
import { log, numStr, upsertTeam } from "./common";

/** The 32 clubs, from the standings feed (the only endpoint that lists every team with its division). */
export async function ingestTeams(db: Db): Promise<number> {
  const { standings } = await nhl.fetchStandings("now");
  // The standings feed has no team id; the schedule feeds do. Resolve ids by abbreviation
  // from the week schedule, falling back to a stable map for teams idle this week.
  const ids = await teamIdsByAbbrev();
  let n = 0;
  for (const r of standings) {
    const abbrev = r.teamAbbrev.default;
    const id = ids.get(abbrev);
    if (!id) {
      log(`teams: no id for ${abbrev}`);
      continue;
    }
    await upsertTeam(db, {
      id,
      abbrev,
      name: r.teamName.default,
      commonName: r.teamCommonName.default,
      placeName: r.placeName.default,
      conference: r.conferenceName ?? null,
      division: r.divisionName ?? null,
      logoUrl: r.teamLogo ?? null,
      logoDarkUrl: r.teamLogoDark ?? null,
    });
    n++;
  }
  log(`teams: ${n} clubs`);
  return n;
}

/**
 * NHL team ids by tricode. Ids are stable (Sharks have been 28 since 1991), so the map is
 * committed; the live schedule feed is consulted first so an expansion team still resolves.
 */
export const NHL_TEAM_IDS: Record<string, number> = {
  NJD: 1, NYI: 2, NYR: 3, PHI: 4, PIT: 5, BOS: 6, BUF: 7, MTL: 8, OTT: 9, TOR: 10,
  CAR: 12, FLA: 13, TBL: 14, WSH: 15, CHI: 16, DET: 17, NSH: 18, STL: 19, CGY: 20, COL: 21,
  EDM: 22, VAN: 23, ANA: 24, DAL: 25, LAK: 26, SJS: 28, CBJ: 29, MIN: 30, WPG: 52, VGK: 54,
  SEA: 55, UTA: 68,
};

async function teamIdsByAbbrev(): Promise<Map<string, number>> {
  const map = new Map<string, number>(Object.entries(NHL_TEAM_IDS));
  try {
    const week = await nhl.fetchScheduleWeek(new Date().toISOString().slice(0, 10));
    for (const day of week.gameWeek) for (const g of day.games) for (const t of [g.homeTeam, g.awayTeam]) map.set(t.abbrev, t.id);
  } catch (err) {
    log("teams: week schedule unavailable, using the committed id map", (err as Error).message);
  }
  return map;
}

/** One standings snapshot for a date. Replaces that date's rows. */
export async function ingestStandings(db: Db, ymd: string): Promise<number> {
  const { standings } = await nhl.fetchStandings(ymd);
  if (!standings.length) {
    log(`standings ${ymd}: empty`);
    return 0;
  }
  const ids = new Map<string, number>(Object.entries(NHL_TEAM_IDS));
  const rows = [];
  for (const r of standings) {
    const abbrev = r.teamAbbrev.default;
    let id = ids.get(abbrev);
    if (!id) {
      const fresh = await teamIdsByAbbrev();
      id = fresh.get(abbrev);
      if (!id) {
        log(`standings ${ymd}: unknown team ${abbrev}`);
        continue;
      }
    }
    await upsertTeam(db, {
      id,
      abbrev,
      name: r.teamName.default,
      commonName: r.teamCommonName.default,
      placeName: r.placeName.default,
      conference: r.conferenceName ?? null,
      division: r.divisionName ?? null,
      logoUrl: r.teamLogo ?? null,
      logoDarkUrl: r.teamLogoDark ?? null,
    });
    rows.push({
      date: ymd,
      teamId: id,
      season: r.seasonId ?? SEASON,
      gamesPlayed: r.gamesPlayed,
      wins: r.wins,
      losses: r.losses,
      otLosses: r.otLosses,
      points: r.points,
      pointPctg: numStr(r.pointPctg),
      regulationWins: r.regulationWins ?? null,
      regulationPlusOtWins: r.regulationPlusOtWins ?? null,
      goalsFor: r.goalFor ?? null,
      goalsAgainst: r.goalAgainst ?? null,
      goalDifferential: r.goalDifferential ?? null,
      homeWins: r.homeWins ?? null,
      homeLosses: r.homeLosses ?? null,
      homeOtLosses: r.homeOtLosses ?? null,
      roadWins: r.roadWins ?? null,
      roadLosses: r.roadLosses ?? null,
      roadOtLosses: r.roadOtLosses ?? null,
      l10Wins: r.l10Wins ?? null,
      l10Losses: r.l10Losses ?? null,
      l10OtLosses: r.l10OtLosses ?? null,
      streakCode: r.streakCode ?? null,
      streakCount: r.streakCount ?? null,
      shootoutWins: r.shootoutWins ?? null,
      shootoutLosses: r.shootoutLosses ?? null,
      divisionSequence: r.divisionSequence ?? null,
      conferenceSequence: r.conferenceSequence ?? null,
      leagueSequence: r.leagueSequence ?? null,
      wildcardSequence: r.wildcardSequence ?? null,
    });
  }
  await db.delete(standingsSnapshots).where(eq(standingsSnapshots.date, ymd));
  if (rows.length) await db.insert(standingsSnapshots).values(rows);
  log(`standings ${ymd}: ${rows.length} teams`);
  return rows.length;
}

export async function ingestStandingsRange(db: Db, dates: string[]): Promise<number> {
  let n = 0;
  for (const d of dates) {
    try {
      n += await ingestStandings(db, d);
    } catch (err) {
      log(`standings ${d} failed:`, (err as Error).message);
    }
  }
  return n;
}
