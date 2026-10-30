import { describe, expect, it } from "vitest";
import { liveFromScore, mergeLive, pollInterval } from "./live";
import type { GameView } from "./views";

const team = { id: 1, abbrev: "X", name: "X", commonName: "X", placeName: "X", logo: null, logoDark: null, conference: null, division: null };
const view: GameView = {
  id: 1,
  season: 20262027,
  gameType: 2,
  gameDate: "2026-10-30",
  startTime: "2026-10-31T02:00:00Z",
  status: "pre",
  gameState: "FUT",
  scheduleState: "OK",
  period: null,
  periodType: null,
  clock: null,
  inIntermission: null,
  lastPeriodType: null,
  home: team,
  away: { ...team, id: 2 },
  homeScore: null,
  awayScore: null,
  homeSog: null,
  awaySog: null,
  venue: null,
  neutralSite: false,
  broadcasts: [],
  hasBoxscore: false,
};

describe("live overlay", () => {
  it("reads a live game from the score feed and merges it", () => {
    const live = liveFromScore({
      id: 1,
      gameState: "LIVE",
      periodDescriptor: { number: 2, periodType: "REG" },
      clock: { timeRemaining: "12:34", inIntermission: false },
      homeTeam: { score: 2, sog: 15 },
      awayTeam: { score: 1, sog: 9 },
    });
    expect(live).toMatchObject({ status: "live", period: 2, clock: "12:34", homeScore: 2, awaySog: 9 });
    const merged = mergeLive(view, live);
    expect(merged.status).toBe("live");
    expect(merged.homeScore).toBe(2);
    expect(merged.clock).toBe("12:34");
  });
  it("drops the clock once final and keeps the overtime marker", () => {
    const live = liveFromScore({ id: 1, gameState: "OFF", periodDescriptor: { number: 4, periodType: "OT" }, homeTeam: { score: 3 }, awayTeam: { score: 2 }, gameOutcome: { lastPeriodType: "OT" } });
    expect(live).toMatchObject({ status: "final", clock: null, lastPeriodType: "OT", period: 4 });
  });
  it("picks a polling cadence", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    expect(pollInterval([{ status: "final", startTime: null }], now)).toBe(0);
    expect(pollInterval([{ status: "live", startTime: null }], now)).toBe(20_000);
    expect(pollInterval([{ status: "pre", startTime: "2026-10-31T02:00:00Z" }], now)).toBe(300_000);
    expect(pollInterval([{ status: "pre", startTime: "2026-10-31T00:10:00Z" }], now)).toBe(20_000);
  });
});
