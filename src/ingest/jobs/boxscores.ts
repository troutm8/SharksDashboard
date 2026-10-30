import { and, eq, inArray, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { gameEvents, gameGoalieStats, gameSkaterStats, games, type GameSummary, type GoalSummary, type PenaltySummary } from "@/db/schema";
import { TEAM_ID } from "@/lib/season";
import * as nhl from "../sources/nhl-web";
import { log, numStr, toiSeconds, upsertPlayerStub } from "./common";

function personName(p: { firstName: { default: string }; lastName: { default: string } } | string | undefined): string | null {
  if (!p) return null;
  if (typeof p === "string") return p;
  return `${p.firstName.default} ${p.lastName.default}`.trim();
}

/** Turn the landing page's summary into the compact shape stored on the game row. */
export function summaryOf(landing: nhl.Landing): GameSummary {
  const goals: GoalSummary[] = [];
  for (const period of landing.summary?.scoring ?? []) {
    for (const g of period.goals) {
      goals.push({
        period: period.periodDescriptor?.number ?? 0,
        periodType: period.periodDescriptor?.periodType ?? "REG",
        timeInPeriod: g.timeInPeriod,
        teamAbbrev: g.teamAbbrev,
        strength: g.strength ?? "ev",
        playerId: g.playerId,
        scorer: g.firstName && g.lastName ? `${g.firstName.default} ${g.lastName.default}` : g.name.default,
        goalsToDate: g.goalsToDate ?? null,
        assists: g.assists.map((a) => ({ playerId: a.playerId, name: a.name.default, assistsToDate: a.assistsToDate ?? null })),
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        shotType: g.shotType ?? null,
        highlightUrl: g.highlightClipSharingUrl ?? null,
      });
    }
  }
  const penalties: PenaltySummary[] = [];
  for (const period of landing.summary?.penalties ?? []) {
    for (const p of period.penalties) {
      penalties.push({
        period: period.periodDescriptor?.number ?? 0,
        periodType: period.periodDescriptor?.periodType ?? "REG",
        timeInPeriod: p.timeInPeriod,
        teamAbbrev: p.teamAbbrev,
        type: p.type,
        duration: p.duration ?? null,
        committedBy: personName(p.committedByPlayer),
        drawnBy: personName(p.drawnBy),
        descKey: p.descKey,
      });
    }
  }
  const threeStars = (landing.summary?.threeStars ?? []).map((s) => ({
    star: s.star,
    playerId: s.playerId,
    teamAbbrev: s.teamAbbrev,
    name: s.name.default,
    sweaterNumber: s.sweaterNo ?? null,
    position: s.position,
    goals: s.goals ?? null,
    assists: s.assists ?? null,
    points: s.points ?? null,
    savePctg: s.savePctg ?? null,
    goalsAgainst: s.goalsAgainst ?? null,
  }));
  return { goals, penalties, threeStars };
}

type Details = Record<string, unknown>;
const int = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Map a play's loosely typed details onto the event columns. */
export function eventRow(gameId: number, p: nhl.PlayByPlay["plays"][number]) {
  const d: Details = p.details ?? {};
  let player1: number | null = null;
  let player2: number | null = null;
  let player3: number | null = null;
  switch (p.typeDescKey) {
    case "goal":
      player1 = int(d.scoringPlayerId);
      player2 = int(d.assist1PlayerId);
      player3 = int(d.assist2PlayerId);
      break;
    case "shot-on-goal":
    case "missed-shot":
      player1 = int(d.shootingPlayerId);
      break;
    case "blocked-shot":
      player1 = int(d.shootingPlayerId);
      player3 = int(d.blockingPlayerId);
      break;
    case "hit":
      player1 = int(d.hittingPlayerId);
      player2 = int(d.hitteePlayerId);
      break;
    case "faceoff":
      player1 = int(d.winningPlayerId);
      player2 = int(d.losingPlayerId);
      break;
    case "penalty":
      player1 = int(d.committedByPlayerId);
      player2 = int(d.drawnByPlayerId);
      break;
    case "giveaway":
    case "takeaway":
      player1 = int(d.playerId);
      break;
  }
  return {
    gameId,
    eventId: p.eventId,
    sortOrder: p.sortOrder,
    period: p.periodDescriptor.number,
    periodType: p.periodDescriptor.periodType,
    timeInPeriod: p.timeInPeriod,
    timeRemaining: p.timeRemaining ?? null,
    typeCode: p.typeCode,
    typeDescKey: p.typeDescKey,
    situationCode: p.situationCode ?? null,
    homeDefendingSide: p.homeTeamDefendingSide ?? null,
    teamId: int(d.eventOwnerTeamId),
    x: int(d.xCoord),
    y: int(d.yCoord),
    zone: str(d.zoneCode),
    shotType: str(d.shotType),
    player1Id: player1,
    player2Id: player2,
    player3Id: player3,
    goalieId: int(d.goalieInNetId),
    homeScore: int(d.homeScore),
    awayScore: int(d.awayScore),
    details: d,
  };
}

/** Box score, summary and play-by-play for one game. Idempotent. */
export async function loadGame(db: Db, gameId: number): Promise<void> {
  const [box, landing, pbp] = await Promise.all([nhl.fetchBoxscore(gameId), nhl.fetchLanding(gameId), nhl.fetchPlayByPlay(gameId)]);

  for (const spot of pbp.rosterSpots) {
    await upsertPlayerStub(db, {
      id: spot.playerId,
      firstName: spot.firstName.default,
      lastName: spot.lastName.default,
      position: spot.positionCode,
      sweaterNumber: spot.sweaterNumber ?? null,
      teamId: spot.teamId,
      headshotUrl: spot.headshot ?? null,
    });
  }

  await db.delete(gameSkaterStats).where(eq(gameSkaterStats.gameId, gameId));
  await db.delete(gameGoalieStats).where(eq(gameGoalieStats.gameId, gameId));
  const sides: [number, nhl.Boxscore["playerByGameStats"]["homeTeam"]][] = [
    [box.homeTeam.id, box.playerByGameStats.homeTeam],
    [box.awayTeam.id, box.playerByGameStats.awayTeam],
  ];
  for (const [teamId, side] of sides) {
    const skaters = [...side.forwards, ...side.defense].map((s) => ({
      gameId,
      playerId: s.playerId,
      teamId,
      name: s.name.default,
      sweaterNumber: s.sweaterNumber ?? null,
      position: s.position,
      goals: s.goals ?? null,
      assists: s.assists ?? null,
      points: s.points ?? null,
      plusMinus: s.plusMinus ?? null,
      pim: s.pim ?? null,
      hits: s.hits ?? null,
      ppGoals: s.powerPlayGoals ?? null,
      sog: s.sog ?? null,
      faceoffPct: numStr(s.faceoffWinningPctg),
      toiSeconds: toiSeconds(s.toi),
      blockedShots: s.blockedShots ?? null,
      shifts: s.shifts ?? null,
      giveaways: s.giveaways ?? null,
      takeaways: s.takeaways ?? null,
    }));
    if (skaters.length) await db.insert(gameSkaterStats).values(skaters);
    const goalies = side.goalies.map((g) => ({
      gameId,
      playerId: g.playerId,
      teamId,
      name: g.name.default,
      sweaterNumber: g.sweaterNumber ?? null,
      starter: g.starter ?? null,
      decision: g.decision ?? null,
      shotsAgainst: g.shotsAgainst ?? null,
      saves: g.saves ?? null,
      goalsAgainst: g.goalsAgainst ?? null,
      savePctg: numStr(g.savePctg),
      evShotsAgainst: g.evenStrengthShotsAgainst ?? null,
      ppShotsAgainst: g.powerPlayShotsAgainst ?? null,
      shShotsAgainst: g.shorthandedShotsAgainst ?? null,
      evGoalsAgainst: g.evenStrengthGoalsAgainst ?? null,
      ppGoalsAgainst: g.powerPlayGoalsAgainst ?? null,
      shGoalsAgainst: g.shorthandedGoalsAgainst ?? null,
      pim: g.pim ?? null,
      toiSeconds: toiSeconds(g.toi),
    }));
    if (goalies.length) await db.insert(gameGoalieStats).values(goalies);
  }

  await db.delete(gameEvents).where(eq(gameEvents.gameId, gameId));
  const events = pbp.plays.map((p) => eventRow(gameId, p));
  for (let i = 0; i < events.length; i += 200) await db.insert(gameEvents).values(events.slice(i, i + 200));

  await db
    .update(games)
    .set({
      summary: summaryOf(landing),
      homeScore: box.homeTeam.score ?? landing.homeTeam.score ?? null,
      awayScore: box.awayTeam.score ?? landing.awayTeam.score ?? null,
      homeSog: box.homeTeam.sog ?? landing.homeTeam.sog ?? null,
      awaySog: box.awayTeam.sog ?? landing.awayTeam.sog ?? null,
      lastPeriodType: box.gameOutcome?.lastPeriodType ?? null,
      boxscoreLoaded: true,
      pbpLoaded: true,
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId));
}

/** Load every finished featured-team game that lacks a box score. */
export async function ingestBoxscores(db: Db, opts: { limit?: number; refresh?: boolean; game?: number; teamId?: number } = {}): Promise<number> {
  const teamId = opts.teamId ?? TEAM_ID;
  const conds = [inArray(games.gameState, ["FINAL", "OFF"]), or(eq(games.homeTeamId, teamId), eq(games.awayTeamId, teamId))!];
  if (opts.game) conds.push(eq(games.id, opts.game));
  else if (!opts.refresh) conds.push(eq(games.boxscoreLoaded, false));
  const pending = await db
    .select({ id: games.id, gameDate: games.gameDate })
    .from(games)
    .where(and(...conds))
    .orderBy(games.gameDate);
  const list = opts.limit ? pending.slice(0, opts.limit) : pending;
  log(`boxscores: ${list.length} to load`);
  let n = 0;
  for (const g of list) {
    try {
      await loadGame(db, g.id);
      n++;
      log(`boxscore ${g.id} (${g.gameDate}) loaded`);
    } catch (err) {
      log(`boxscore ${g.id} failed:`, (err as Error).message);
    }
  }
  return n;
}
