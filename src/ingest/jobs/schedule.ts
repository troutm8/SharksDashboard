import type { Db } from "@/db/client";
import { games } from "@/db/schema";
import { TEAM_ABBREV, addDays } from "@/lib/season";
import * as nhl from "../sources/nhl-web";
import { log, teamExists, upsertTeam } from "./common";

/** Insert or refresh one game from any of the schedule-shaped payloads. Never touches the box-score flags. */
export async function upsertGame(db: Db, g: nhl.ScheduleGame, dayDate?: string): Promise<void> {
  for (const t of [g.homeTeam, g.awayTeam]) {
    if (!(await teamExists(db, t.id))) {
      await upsertTeam(db, {
        id: t.id,
        abbrev: t.abbrev,
        commonName: t.commonName?.default ?? t.name?.default ?? null,
        placeName: t.placeName?.default ?? null,
        logoUrl: t.logo ?? null,
        logoDarkUrl: t.darkLogo ?? null,
      });
    }
  }
  const periodNumber = g.periodDescriptor?.number ?? g.period ?? null;
  const live = g.gameState === "LIVE" || g.gameState === "CRIT";
  const row = {
    id: g.id,
    season: g.season,
    gameType: g.gameType,
    gameDate: nhl.gameDateOf(g, dayDate),
    startTimeUtc: new Date(g.startTimeUTC),
    venue: g.venue?.default ?? null,
    venueTimezone: g.venueTimezone ?? null,
    neutralSite: g.neutralSite ?? null,
    homeTeamId: g.homeTeam.id,
    awayTeamId: g.awayTeam.id,
    homeScore: g.homeTeam.score ?? null,
    awayScore: g.awayTeam.score ?? null,
    homeSog: g.homeTeam.sog ?? null,
    awaySog: g.awayTeam.sog ?? null,
    gameState: g.gameState,
    scheduleState: g.gameScheduleState ?? null,
    period: g.gameState === "FUT" || g.gameState === "PRE" ? null : periodNumber,
    periodType: g.gameState === "FUT" || g.gameState === "PRE" ? null : (g.periodDescriptor?.periodType ?? null),
    clock: live ? (g.clock?.timeRemaining ?? null) : null,
    inIntermission: live ? (g.clock?.inIntermission ?? null) : null,
    lastPeriodType: g.gameOutcome?.lastPeriodType ?? null,
    broadcasts: nhl.broadcastsOf(g),
    updatedAt: new Date(),
  };
  await db.insert(games).values(row).onConflictDoUpdate({ target: games.id, set: row });
}

/** The featured club's whole season, preseason included. Re-run nightly: postponements move. */
export async function ingestClubSchedule(db: Db, abbrev = TEAM_ABBREV): Promise<number> {
  const sched = await nhl.fetchClubSchedule(abbrev, "now");
  for (const g of sched.games) await upsertGame(db, g);
  log(`schedule ${abbrev}: ${sched.games.length} games (season ${sched.currentSeason})`);
  return sched.games.length;
}

/** Every NHL game between two dates, walking the seven-day schedule endpoint. */
export async function ingestLeagueSchedule(db: Db, from: string, to: string): Promise<number> {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 7)) {
    const week = await nhl.fetchScheduleWeek(d);
    let w = 0;
    for (const day of week.gameWeek) {
      if (day.date < from || day.date > to) continue;
      for (const g of day.games) {
        await upsertGame(db, g, day.date);
        w++;
      }
    }
    log(`schedule week ${d}: ${w} games`);
    n += w;
  }
  return n;
}

/** One day's league scoreboard: the live endpoint with period, clock and shots. */
export async function ingestScores(db: Db, dates: string[]): Promise<number> {
  let n = 0;
  for (const ymd of dates) {
    const day = await nhl.fetchScoreDay(ymd);
    for (const g of day.games) await upsertGame(db, g);
    log(`scores ${ymd}: ${day.games.length} games`);
    n += day.games.length;
  }
  return n;
}
