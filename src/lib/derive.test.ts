import { describe, expect, it } from "vitest";
import type { Game, StandingsRow, Team } from "@/db/schema";
import { POWER_WEIGHTS, computeRecord, groupStandings, outcomeFor, playoffPicture, pointsPace, powerRankings, powerRating, rankOf, seasonSeries } from "./derive";

const SJS = 28;
const VGK = 54;
const LAK = 26;
const BOS = 6;

function game(id: number, date: string, home: number, away: number, hs: number | null, as: number | null, last: string | null = "REG", state = "OFF", type = 2): Game {
  return {
    id,
    season: 20262027,
    gameType: type,
    gameDate: date,
    startTimeUtc: new Date(`${date}T03:00:00Z`),
    venue: null,
    venueTimezone: null,
    neutralSite: false,
    homeTeamId: home,
    awayTeamId: away,
    homeScore: hs,
    awayScore: as,
    homeSog: null,
    awaySog: null,
    gameState: state,
    scheduleState: "OK",
    period: null,
    periodType: null,
    clock: null,
    inIntermission: null,
    lastPeriodType: last,
    broadcasts: [],
    summary: null,
    boxscoreLoaded: false,
    pbpLoaded: false,
    updatedAt: new Date(),
  };
}

const teams = new Map<number, Team>([
  [SJS, { id: SJS, abbrev: "SJS", name: "San Jose Sharks", commonName: "Sharks", placeName: "San Jose", conference: "Western", division: "Pacific", logoUrl: null, logoDarkUrl: null, updatedAt: new Date() }],
  [VGK, { id: VGK, abbrev: "VGK", name: "Vegas Golden Knights", commonName: "Golden Knights", placeName: "Vegas", conference: "Western", division: "Pacific", logoUrl: null, logoDarkUrl: null, updatedAt: new Date() }],
  [LAK, { id: LAK, abbrev: "LAK", name: "Los Angeles Kings", commonName: "Kings", placeName: "Los Angeles", conference: "Western", division: "Pacific", logoUrl: null, logoDarkUrl: null, updatedAt: new Date() }],
  [BOS, { id: BOS, abbrev: "BOS", name: "Boston Bruins", commonName: "Bruins", placeName: "Boston", conference: "Eastern", division: "Atlantic", logoUrl: null, logoDarkUrl: null, updatedAt: new Date() }],
]);

const games: Game[] = [
  game(1, "2026-09-25", SJS, VGK, 5, 1, "REG", "OFF", 1), // preseason, ignored
  game(2, "2026-10-01", SJS, BOS, 3, 2, "OT"), // W (OT) home, one-goal
  game(3, "2026-10-03", SJS, LAK, 1, 4), // L home
  game(4, "2026-10-08", VGK, SJS, 2, 3, "SO"), // W (SO) road, one-goal
  game(5, "2026-10-10", LAK, SJS, 3, 2, "OT"), // OTL road, one-goal
  game(6, "2026-11-01", SJS, VGK, 4, 1), // W home, regulation
  game(7, "2026-11-04", LAK, SJS, null, null, null, "FUT"), // not played
];

describe("records", () => {
  it("classifies outcomes with OT and shootout losses", () => {
    expect(outcomeFor(SJS, games[1])).toBe("W");
    expect(outcomeFor(SJS, games[2])).toBe("L");
    expect(outcomeFor(SJS, games[4])).toBe("OTL");
    expect(outcomeFor(LAK, games[4])).toBe("W");
    expect(outcomeFor(SJS, games[6])).toBeNull();
  });
  it("computes the record, points, splits and streak from regular-season finals only", () => {
    const r = computeRecord(SJS, games, teams);
    expect(r.gp).toBe(5);
    expect([r.w, r.l, r.otl]).toEqual([3, 1, 1]);
    expect(r.points).toBe(7);
    expect(r.regulationWins).toBe(1);
    expect([r.gf, r.ga]).toEqual([13, 12]);
    expect(r.home).toEqual({ w: 2, l: 1, otl: 0 });
    expect(r.road).toEqual({ w: 1, l: 0, otl: 1 });
    expect(r.oneGoal).toEqual({ w: 2, l: 0, otl: 1 });
    expect(r.overtime).toEqual({ w: 2, l: 0, otl: 1 });
    expect(r.vsDivision).toEqual({ w: 2, l: 1, otl: 1 });
    expect(r.vsConference).toEqual({ w: 2, l: 1, otl: 1 });
    expect(r.byMonth.map((m) => m.month)).toEqual(["2026-10", "2026-11"]);
    expect(r.streak).toBe("W1");
    expect(r.last10).toEqual(["W", "L", "W", "OTL", "W"]);
  });
  it("names an overtime-loss streak", () => {
    const r = computeRecord(SJS, [game(10, "2026-10-01", SJS, LAK, 2, 3, "OT"), game(11, "2026-10-02", SJS, LAK, 2, 3, "SO")]);
    expect(r.streak).toBe("OTL2");
  });
  it("computes the season series", () => {
    const s = seasonSeries(SJS, VGK, games);
    expect(s.split).toEqual({ w: 2, l: 0, otl: 0 });
    expect(s.games.map((g) => g.id)).toEqual([4, 6]);
  });
  it("projects a points pace over 84 games", () => {
    expect(pointsPace(15, 14)).toBe(90);
    expect(pointsPace(0, 0)).toBe(0);
  });
  it("ranks values in either direction", () => {
    expect(rankOf(3.2, [2.5, 3.2, 4.0])).toBe(2);
    expect(rankOf(3.2, [2.5, 3.2, 4.0], false)).toBe(2);
    expect(rankOf(4.0, [2.5, 3.2, 4.0])).toBe(1);
    expect(rankOf(null, [1])).toBeNull();
  });
});

describe("power rating", () => {
  it("gives a perfect team 100 and a hopeless one 0", () => {
    expect(powerRating({ teamId: 1, gamesPlayed: 10, pointPct: 1, goalDifferential: 20, xgPct: 0.65, l10Points: 20, l10Games: 10 }).score).toBe(100);
    expect(powerRating({ teamId: 1, gamesPlayed: 10, pointPct: 0, goalDifferential: -20, xgPct: 0.35, l10Points: 0, l10Games: 10 }).score).toBe(0);
  });
  it("treats missing xG as neutral and sums the published weights", () => {
    const r = powerRating({ teamId: 28, gamesPlayed: 14, pointPct: 0.5, goalDifferential: 0, xgPct: null, l10Points: 10, l10Games: 10 });
    expect(r.components.xg).toBe(POWER_WEIGHTS.xg / 2);
    expect(r.score).toBe(50);
    expect(Object.values(POWER_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("ranks teams by score", () => {
    const ranked = powerRankings([
      { teamId: 1, gamesPlayed: 10, pointPct: 0.6, goalDifferential: 5, xgPct: 0.52, l10Points: 12, l10Games: 10 },
      { teamId: 2, gamesPlayed: 10, pointPct: 0.7, goalDifferential: 9, xgPct: 0.55, l10Points: 14, l10Games: 10 },
    ]);
    expect(ranked.map((r) => [r.teamId, r.rank])).toEqual([
      [2, 1],
      [1, 2],
    ]);
  });
});

function row(teamId: number, points: number, gp: number, div: number, wc: number, confSeq: number): StandingsRow {
  return {
    date: "2026-10-30",
    teamId,
    season: 20262027,
    gamesPlayed: gp,
    wins: Math.floor(points / 2),
    losses: gp - Math.floor(points / 2) - (points % 2),
    otLosses: points % 2,
    points,
    pointPctg: null,
    regulationWins: null,
    regulationPlusOtWins: null,
    goalsFor: null,
    goalsAgainst: null,
    goalDifferential: null,
    homeWins: null,
    homeLosses: null,
    homeOtLosses: null,
    roadWins: null,
    roadLosses: null,
    roadOtLosses: null,
    l10Wins: null,
    l10Losses: null,
    l10OtLosses: null,
    streakCode: null,
    streakCount: null,
    shootoutWins: null,
    shootoutLosses: null,
    divisionSequence: div,
    conferenceSequence: confSeq,
    leagueSequence: null,
    wildcardSequence: wc,
  };
}

describe("playoff picture", () => {
  const west = new Map<number, Team>(teams);
  // A Central division of three plus our three Pacific teams: six "inside", Sharks as first team out.
  west.set(21, { ...teams.get(VGK)!, id: 21, abbrev: "COL", division: "Central" });
  west.set(25, { ...teams.get(VGK)!, id: 25, abbrev: "DAL", division: "Central" });
  west.set(30, { ...teams.get(VGK)!, id: 30, abbrev: "MIN", division: "Central" });
  west.set(55, { ...teams.get(VGK)!, id: 55, abbrev: "SEA", division: "Pacific" });
  west.set(24, { ...teams.get(VGK)!, id: 24, abbrev: "ANA", division: "Pacific" });
  const rows = [
    row(21, 20, 14, 1, 0, 1),
    row(VGK, 19, 14, 1, 0, 2),
    row(25, 18, 14, 2, 0, 3),
    row(LAK, 18, 15, 2, 0, 4),
    row(30, 17, 14, 3, 0, 5),
    row(55, 17, 14, 3, 0, 6),
    row(24, 16, 15, 4, 1, 7),
    row(SJS, 15, 14, 5, 2, 8),
    row(BOS, 30, 14, 1, 0, 1), // other conference, ignored
  ];
  it("orders division top threes then wild cards, and places the featured team", () => {
    const p = playoffPicture(rows, west, "Western", SJS);
    expect(p.inside.map((r) => r.teamId)).toEqual([21, 25, 30, VGK, LAK, 55, 24, SJS]);
    expect(p.outside).toEqual([]);
    expect(p.cutLine?.teamId).toBe(SJS);
    expect(p.featured?.inPlayoffs).toBe(true);
    expect(p.featured?.slot).toBe("Second wild card");
  });
  it("measures the gap to the line from outside", () => {
    // Vancouver takes the second wild card on 16 points from 15 games; the Sharks drop to first out on 14 from 14.
    const outside = rows.map((r) => (r.teamId === SJS ? { ...r, points: 14, wildcardSequence: 3, conferenceSequence: 9 } : r));
    outside.push(row(23, 16, 15, 6, 2, 8));
    const p = playoffPicture(outside, new Map([...west, [23, { ...teams.get(VGK)!, id: 23, abbrev: "VAN" }]]), "Western", SJS);
    expect(p.inside.length).toBe(8);
    expect(p.cutLine?.teamId).toBe(23);
    expect(p.featured?.inPlayoffs).toBe(false);
    expect(p.featured?.pointsVsLine).toBe(-2);
    expect(p.featured?.gamesInHand).toBe(1);
    expect(p.featured?.slot).toBe("1st out of the wild card");
    expect(p.outside.map((r) => r.teamId)).toEqual([SJS]);
  });
  it("groups a snapshot by division in sequence order", () => {
    const g = groupStandings(rows, west, "division");
    expect(g.map((x) => x.name)).toEqual(["Atlantic", "Central", "Pacific"]);
    expect(g[2].rows.map((r) => r.teamId)).toEqual([VGK, LAK, 55, 24, SJS]);
  });
});
