import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { advancedSkaterStats, advancedTeamStats, oddsSnapshots } from "@/db/schema";
import { SEASON, SEASON_START_YEAR, TEAM_ABBREV, todayPacific } from "@/lib/season";
import * as mp from "../sources/moneypuck";
import { log, numStr, teamIdByAbbrev } from "./common";

/** Playoff, division, Cup and lottery odds for all 32 teams. One snapshot per day. */
export async function ingestOdds(db: Db): Promise<number> {
  const date = todayPacific();
  const ids = await teamIdByAbbrev(db);
  const rows = [];
  for (const r of await mp.fetchSimulations()) {
    if (r.scenerio !== "ALL") continue;
    const id = ids.get(mp.nhlAbbrevOf(r.teamCode));
    if (!id) {
      log(`odds: unknown team code ${r.teamCode}`);
      continue;
    }
    rows.push({
      date,
      teamId: id,
      madePlayoffs: numStr(r.madePlayoffs),
      round2: numStr(r.round2),
      round3: numStr(r.round3),
      round4: numStr(r.round4),
      wonCup: numStr(r.wonCup),
      wonDivision: numStr(r.wonDivision),
      firstOverall: numStr(r.firstOverall),
      draftLottery: numStr(r.draftLottery),
      wildcard1: numStr(r.wildcard1Odds),
      wildcard2: numStr(r.wildcard2Odds),
      projectedPoints: numStr(r.points),
    });
  }
  await db.delete(oddsSnapshots).where(eq(oddsSnapshots.date, date));
  if (rows.length) await db.insert(oddsSnapshots).values(rows);
  log(`odds: ${rows.length} teams (${date})`);
  return rows.length;
}

/** Expected-goals and shot-share numbers: every team by situation, featured-club skaters by situation. */
export async function ingestAdvanced(db: Db, startYear = SEASON_START_YEAR): Promise<number> {
  const date = todayPacific();
  const ids = await teamIdByAbbrev(db);

  const teamRows = [];
  for (const r of await mp.fetchTeams(startYear)) {
    const id = ids.get(mp.nhlAbbrevOf(r.team));
    if (!id) {
      log(`advanced: unknown team code ${r.team}`);
      continue;
    }
    teamRows.push({
      season: SEASON,
      teamId: id,
      situation: r.situation,
      snapshotDate: date,
      gamesPlayed: r.games_played,
      iceTime: numStr(r.iceTime),
      xGoalsPct: numStr(r.xGoalsPercentage),
      corsiPct: numStr(r.corsiPercentage),
      fenwickPct: numStr(r.fenwickPercentage),
      xGoalsFor: numStr(r.xGoalsFor),
      xGoalsAgainst: numStr(r.xGoalsAgainst),
      goalsFor: r.goalsFor == null ? null : Math.round(r.goalsFor),
      goalsAgainst: r.goalsAgainst == null ? null : Math.round(r.goalsAgainst),
      shotsOnGoalFor: r.shotsOnGoalFor == null ? null : Math.round(r.shotsOnGoalFor),
      shotsOnGoalAgainst: r.shotsOnGoalAgainst == null ? null : Math.round(r.shotsOnGoalAgainst),
      shotAttemptsFor: r.shotAttemptsFor == null ? null : Math.round(r.shotAttemptsFor),
      shotAttemptsAgainst: r.shotAttemptsAgainst == null ? null : Math.round(r.shotAttemptsAgainst),
      highDangerXGoalsFor: numStr(r.highDangerxGoalsFor),
      highDangerXGoalsAgainst: numStr(r.highDangerxGoalsAgainst),
      highDangerGoalsFor: r.highDangerGoalsFor == null ? null : Math.round(r.highDangerGoalsFor),
      highDangerGoalsAgainst: r.highDangerGoalsAgainst == null ? null : Math.round(r.highDangerGoalsAgainst),
    });
  }
  await db.delete(advancedTeamStats).where(and(eq(advancedTeamStats.season, SEASON), eq(advancedTeamStats.snapshotDate, date)));
  for (let i = 0; i < teamRows.length; i += 200) await db.insert(advancedTeamStats).values(teamRows.slice(i, i + 200));

  const skaterRows = [];
  for (const r of await mp.fetchSkaters(startYear)) {
    if (mp.nhlAbbrevOf(r.team) !== TEAM_ABBREV) continue;
    skaterRows.push({
      season: SEASON,
      playerId: r.playerId,
      situation: r.situation,
      snapshotDate: date,
      name: r.name,
      teamAbbrev: TEAM_ABBREV,
      position: r.position,
      gamesPlayed: r.games_played,
      iceTime: numStr(r.icetime),
      gameScore: numStr(r.gameScore),
      onIceXGoalsPct: numStr(r.onIce_xGoalsPercentage),
      offIceXGoalsPct: numStr(r.offIce_xGoalsPercentage),
      onIceCorsiPct: numStr(r.onIce_corsiPercentage),
      iXGoals: numStr(r.I_F_xGoals),
      iGoals: r.I_F_goals == null ? null : Math.round(r.I_F_goals),
      iPrimaryAssists: r.I_F_primaryAssists == null ? null : Math.round(r.I_F_primaryAssists),
      iSecondaryAssists: r.I_F_secondaryAssists == null ? null : Math.round(r.I_F_secondaryAssists),
      iPoints: r.I_F_points == null ? null : Math.round(r.I_F_points),
      iShotsOnGoal: r.I_F_shotsOnGoal == null ? null : Math.round(r.I_F_shotsOnGoal),
      iHighDangerXGoals: numStr(r.I_F_highDangerxGoals),
      iHits: r.I_F_hits == null ? null : Math.round(r.I_F_hits),
      iTakeaways: r.I_F_takeaways == null ? null : Math.round(r.I_F_takeaways),
      iGiveaways: r.I_F_giveaways == null ? null : Math.round(r.I_F_giveaways),
      shotsBlocked: r.shotsBlockedByPlayer == null ? null : Math.round(r.shotsBlockedByPlayer),
      onIceXGoalsFor: numStr(r.OnIce_F_xGoals),
      onIceXGoalsAgainst: numStr(r.OnIce_A_xGoals),
    });
  }
  await db.delete(advancedSkaterStats).where(and(eq(advancedSkaterStats.season, SEASON), eq(advancedSkaterStats.snapshotDate, date)));
  for (let i = 0; i < skaterRows.length; i += 200) await db.insert(advancedSkaterStats).values(skaterRows.slice(i, i + 200));

  log(`advanced: ${teamRows.length} team rows, ${skaterRows.length} skater rows (${date})`);
  return teamRows.length + skaterRows.length;
}
