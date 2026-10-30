import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { goalieSeasonStats, skaterSeasonStats, teamSeasonStats } from "@/db/schema";
import { SEASON, todayPacific } from "@/lib/season";
import * as stats from "../sources/nhl-stats";
import { log, numStr, teamExists } from "./common";

/** League-wide skater and goalie season lines, one snapshot per day. */
export async function ingestPlayerStats(db: Db, season = SEASON): Promise<number> {
  const date = todayPacific();
  const [skaters, goalies] = await Promise.all([stats.fetchSkaterSummary(season), stats.fetchGoalieSummary(season)]);

  const skaterRows = skaters.data.map((r) => ({
    season,
    playerId: r.playerId,
    snapshotDate: date,
    fullName: r.skaterFullName,
    teamAbbrevs: r.teamAbbrevs ?? null,
    position: r.positionCode ?? null,
    shootsCatches: r.shootsCatches ?? null,
    gamesPlayed: r.gamesPlayed ?? null,
    goals: r.goals ?? null,
    assists: r.assists ?? null,
    points: r.points ?? null,
    plusMinus: r.plusMinus ?? null,
    pim: r.penaltyMinutes ?? null,
    ppGoals: r.ppGoals ?? null,
    ppPoints: r.ppPoints ?? null,
    shGoals: r.shGoals ?? null,
    shPoints: r.shPoints ?? null,
    evGoals: r.evGoals ?? null,
    evPoints: r.evPoints ?? null,
    gwGoals: r.gameWinningGoals ?? null,
    otGoals: r.otGoals ?? null,
    shots: r.shots ?? null,
    shootingPct: numStr(r.shootingPct),
    toiPerGame: numStr(r.timeOnIcePerGame),
    faceoffWinPct: numStr(r.faceoffWinPct),
    pointsPerGame: numStr(r.pointsPerGame),
  }));
  await db.delete(skaterSeasonStats).where(and(eq(skaterSeasonStats.season, season), eq(skaterSeasonStats.snapshotDate, date)));
  for (let i = 0; i < skaterRows.length; i += 200) await db.insert(skaterSeasonStats).values(skaterRows.slice(i, i + 200));

  const goalieRows = goalies.data.map((r) => ({
    season,
    playerId: r.playerId,
    snapshotDate: date,
    fullName: r.goalieFullName,
    teamAbbrevs: r.teamAbbrevs ?? null,
    gamesPlayed: r.gamesPlayed ?? null,
    gamesStarted: r.gamesStarted ?? null,
    wins: r.wins ?? null,
    losses: r.losses ?? null,
    otLosses: r.otLosses ?? null,
    shotsAgainst: r.shotsAgainst ?? null,
    saves: r.saves ?? null,
    goalsAgainst: r.goalsAgainst ?? null,
    gaa: numStr(r.goalsAgainstAverage),
    savePct: numStr(r.savePct),
    shutouts: r.shutouts ?? null,
    toiSeconds: r.timeOnIce != null ? Math.round(r.timeOnIce) : null,
    assists: r.assists ?? null,
    goals: r.goals ?? null,
    pim: r.penaltyMinutes ?? null,
  }));
  await db.delete(goalieSeasonStats).where(and(eq(goalieSeasonStats.season, season), eq(goalieSeasonStats.snapshotDate, date)));
  for (let i = 0; i < goalieRows.length; i += 200) await db.insert(goalieSeasonStats).values(goalieRows.slice(i, i + 200));

  log(`player stats: ${skaterRows.length} skaters, ${goalieRows.length} goalies (${date})`);
  return skaterRows.length + goalieRows.length;
}

/** Team season totals for all 32 clubs, one snapshot per day. */
export async function ingestTeamStats(db: Db, season = SEASON): Promise<number> {
  const date = todayPacific();
  const { data } = await stats.fetchTeamSummary(season);
  const rows = [];
  for (const r of data) {
    if (!(await teamExists(db, r.teamId))) {
      log(`team stats: unknown team ${r.teamId} ${r.teamFullName}`);
      continue;
    }
    rows.push({
      season,
      teamId: r.teamId,
      snapshotDate: date,
      gamesPlayed: r.gamesPlayed ?? null,
      wins: r.wins ?? null,
      losses: r.losses ?? null,
      otLosses: r.otLosses ?? null,
      points: r.points ?? null,
      pointPct: numStr(r.pointPct),
      goalsFor: r.goalsFor ?? null,
      goalsAgainst: r.goalsAgainst ?? null,
      goalsForPerGame: numStr(r.goalsForPerGame),
      goalsAgainstPerGame: numStr(r.goalsAgainstPerGame),
      ppPct: numStr(r.powerPlayPct),
      pkPct: numStr(r.penaltyKillPct),
      ppNetPct: numStr(r.powerPlayNetPct),
      pkNetPct: numStr(r.penaltyKillNetPct),
      shotsForPerGame: numStr(r.shotsForPerGame),
      shotsAgainstPerGame: numStr(r.shotsAgainstPerGame),
      faceoffWinPct: numStr(r.faceoffWinPct),
      regulationAndOtWins: r.regulationAndOtWins ?? null,
      winsInRegulation: r.winsInRegulation ?? null,
      winsInShootout: r.winsInShootout ?? null,
      shutouts: r.teamShutouts ?? null,
    });
  }
  await db.delete(teamSeasonStats).where(and(eq(teamSeasonStats.season, season), eq(teamSeasonStats.snapshotDate, date)));
  if (rows.length) await db.insert(teamSeasonStats).values(rows);
  log(`team stats: ${rows.length} teams (${date})`);
  return rows.length;
}
