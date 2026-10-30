import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as nhl from "./sources/nhl-web";
import * as stats from "./sources/nhl-stats";
import * as mp from "./sources/moneypuck";
import { eventRow, summaryOf } from "./jobs/boxscores";

const fx = (name: string) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");
const json = (name: string) => JSON.parse(fx(name));

describe("NHL web API payloads", () => {
  it("parses the club schedule with preseason and regular-season games", () => {
    const s = nhl.clubScheduleSchema.parse(json("nhl-club-schedule.json"));
    expect(s.currentSeason).toBe(20262027);
    expect(s.games.length).toBeGreaterThan(80);
    expect(new Set(s.games.map((g) => g.gameType))).toEqual(new Set([1, 2]));
    const final = s.games.find((g) => g.gameState === "OFF")!;
    expect(final.homeTeam.score).toEqual(expect.any(Number));
    expect(final.gameOutcome?.lastPeriodType).toMatch(/^(REG|OT|SO)$/);
    expect(nhl.broadcastsOf(final)[0]).toEqual({ network: expect.any(String), market: expect.any(String), countryCode: expect.any(String) });
  });
  it("parses the day scoreboard and a week of schedule", () => {
    const d = nhl.scoreDaySchema.parse(json("nhl-score-day.json"));
    expect(d.currentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(d.games.length).toBeGreaterThan(0);
    const w = nhl.scheduleWeekSchema.parse(json("nhl-schedule-week.json"));
    expect(w.gameWeek.length).toBe(7);
    expect(w.gameWeek[0].games[0].homeTeam.id).toEqual(expect.any(Number));
    // The week feed omits gameDate; the day it sits under wins, then the Eastern start date.
    const undated = w.gameWeek.flatMap((d) => d.games.map((g) => ({ g, day: d.date }))).find(({ g }) => !g.gameDate)!;
    expect(nhl.gameDateOf(undated.g, undated.day)).toBe(undated.day);
    expect(nhl.gameDateOf({ startTimeUTC: "2026-11-06T02:30:00Z" })).toBe("2026-11-05");
  });
  it("parses standings with wild-card order and splits", () => {
    const s = nhl.standingsSchema.parse(json("nhl-standings.json"));
    expect(s.standings.length).toBe(32);
    const sjs = s.standings.find((r) => r.teamAbbrev.default === "SJS")!;
    expect(sjs.divisionName).toBe("Pacific");
    expect(sjs.wildcardSequence).toEqual(expect.any(Number));
    expect(sjs.points).toBe(sjs.wins * 2 + sjs.otLosses);
  });
  it("parses the roster", () => {
    const r = nhl.rosterSchema.parse(json("nhl-roster.json"));
    expect(r.goalies.length).toBeGreaterThanOrEqual(2);
    expect(r.forwards[0].firstName.default).toBeTruthy();
  });
  it("parses a box score with both benches", () => {
    const b = nhl.boxscoreSchema.parse(json("nhl-boxscore.json"));
    expect(b.homeTeam.abbrev).toBe("SJS");
    expect(b.playerByGameStats.homeTeam.goalies[0].saveShotsAgainst).toMatch(/^\d+\/\d+$/);
    expect(b.playerByGameStats.awayTeam.forwards.length).toBeGreaterThan(8);
  });
  it("turns the landing summary into goals, penalties and three stars", () => {
    const l = nhl.landingSchema.parse(json("nhl-landing.json"));
    const s = summaryOf(l);
    expect(s.goals.length).toBe(5);
    expect(s.goals[0]).toMatchObject({ period: 1, teamAbbrev: "VAN", scorer: "Drew O'Connor", assists: [{ name: "E. Pettersson" }] });
    expect(s.penalties.length).toBeGreaterThan(0);
    expect(s.penalties[0].committedBy).toBe("Arshdeep Bains");
    expect(s.threeStars.map((t) => t.star)).toEqual([1, 2, 3]);
  });
  it("maps play-by-play events to columns", () => {
    const p = nhl.playByPlaySchema.parse(json("nhl-play-by-play.json"));
    expect(p.rosterSpots.length).toBe(40);
    const rows = p.plays.map((play) => eventRow(p.id, play));
    const goal = rows.find((r) => r.typeDescKey === "goal")!;
    expect(goal).toMatchObject({ player1Id: 8482055, player2Id: 8480012, goalieId: 8482137, x: -82, y: -3, shotType: "wrist", homeScore: 0, awayScore: 1 });
    const faceoff = rows.find((r) => r.typeDescKey === "faceoff")!;
    expect(faceoff.player1Id).toEqual(expect.any(Number));
    expect(faceoff.player2Id).toEqual(expect.any(Number));
    const hit = rows.find((r) => r.typeDescKey === "hit")!;
    expect(hit.player2Id).toEqual(expect.any(Number));
  });
  it("parses a player landing page and game log", () => {
    const p = nhl.playerLandingSchema.parse(json("nhl-player-landing.json"));
    expect(p.firstName.default).toBe("Macklin");
    expect(p.draftDetails?.overallPick).toBe(1);
    expect(p.seasonTotals.length).toBeGreaterThan(5);
    const g = nhl.playerGameLogSchema.parse(json("nhl-player-gamelog.json"));
    expect(g.gameLog[0].gameId).toEqual(expect.any(Number));
  });
  it("parses league leaders", () => {
    const s = nhl.leadersSchema.parse(json("nhl-skater-leaders.json"));
    expect(Object.keys(s)).toContain("points");
    expect(s.goals[0].value).toBeGreaterThan(0);
    const g = nhl.leadersSchema.parse(json("nhl-goalie-leaders.json"));
    expect(Object.keys(g)).toContain("savePctg");
  });
  it("picks US networks for display", () => {
    expect(nhl.usBroadcasts([{ network: "SN+", market: "N", countryCode: "CA" }, { network: "TNT", market: "N", countryCode: "US" }])).toEqual(["TNT"]);
    expect(nhl.usBroadcasts([{ network: "SN+", market: "N", countryCode: "CA" }])).toEqual(["SN+"]);
  });
});

describe("NHL stats REST payloads", () => {
  it("parses skater, goalie and team summaries", () => {
    const s = stats.skaterSummarySchema.parse(json("stats-skater-summary.json"));
    expect(s.data[0].skaterFullName).toBeTruthy();
    const g = stats.goalieSummarySchema.parse(json("stats-goalie-summary.json"));
    expect(g.data[0].savePct).toEqual(expect.any(Number));
    const t = stats.teamSummarySchema.parse(json("stats-team-summary.json"));
    expect(t.data.length).toBe(32);
    expect(t.data.find((r) => r.teamId === 28)?.teamFullName).toBe("San Jose Sharks");
    const gl = stats.teamSummarySchema.parse(json("stats-team-gamelog.json"));
    expect(gl.data[0].gameId).toEqual(expect.any(Number));
    expect(gl.data[0].opponentTeamAbbrev).toBeTruthy();
  });
  it("parses the season list", () => {
    const s = stats.seasonSchema.parse(json("stats-season.json"));
    expect(s.data[0].id).toBe(20262027);
    expect(s.data[0].numberOfGames).toBe(84);
  });
});

describe("MoneyPuck CSVs", () => {
  it("parses quoted CSV fields", () => {
    expect(mp.parseCsv('a,b\n1,"x, y"\n2,"say ""hi"""\n')).toEqual([
      { a: "1", b: "x, y" },
      { a: "2", b: 'say "hi"' },
    ]);
  });
  it("parses simulations with the ALL scenario", () => {
    const rows = mp.parseSimulations(fx("moneypuck-simulations.csv"));
    const sjs = rows.find((r) => r.teamCode === "SJS" && r.scenerio === "ALL")!;
    expect(sjs.madePlayoffs).toBeGreaterThan(0);
    expect(sjs.madePlayoffs).toBeLessThan(1);
    expect(sjs.points).toBeGreaterThan(50);
  });
  it("parses team and skater tables", () => {
    const teams = mp.parseTeams(fx("moneypuck-teams.csv"));
    const all = teams.find((t) => t.team === "SJS" && t.situation === "all")!;
    expect(all.xGoalsPercentage).toBeGreaterThan(0);
    expect(all.games_played).toBe(14);
    const skaters = mp.parseSkaters(fx("moneypuck-skaters.csv"));
    expect(skaters.every((s) => s.team === "SJS")).toBe(true);
    expect(skaters[0].playerId).toBeGreaterThan(8_000_000);
  });
  it("maps legacy team codes", () => {
    expect(mp.nhlAbbrevOf("S.J")).toBe("SJS");
    expect(mp.nhlAbbrevOf("SJS")).toBe("SJS");
  });
});
