/**
 * Ingestion CLI.
 *
 *   pnpm ingest teams                               # the 32 clubs, from the standings feed
 *   pnpm ingest schedule [--from D] [--to D]        # featured club's season + every NHL game in the range
 *   pnpm ingest scores [--date D | --from D --to D] # live scoreboard for the dates (period, clock, shots)
 *   pnpm ingest standings [--date D | --from D --to D]
 *   pnpm ingest boxscores [--limit N] [--refresh] [--game ID]
 *   pnpm ingest roster [--enrich]
 *   pnpm ingest stats                               # league skater, goalie and team season lines
 *   pnpm ingest odds                                # MoneyPuck simulations
 *   pnpm ingest advanced                            # MoneyPuck xG tables
 *   pnpm ingest today                               # scores yesterday..tomorrow, then new box scores
 *   pnpm ingest nightly                             # schedule -3..+7, scores, standings, roster, stats, odds, advanced, box scores
 *   pnpm ingest backfill                            # the whole season so far
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ingestRuns } from "@/db/schema";
import { SEASON_END, SEASON_START, addDays, dateRange, isValidYmd, todayPacific } from "@/lib/season";
import { ingestBoxscores } from "./jobs/boxscores";
import { log } from "./jobs/common";
import { ingestAdvanced, ingestOdds } from "./jobs/moneypuck";
import { enrichPlayers, ingestRoster } from "./jobs/roster";
import { ingestClubSchedule, ingestLeagueSchedule, ingestScores } from "./jobs/schedule";
import { ingestStandings, ingestStandingsRange, ingestTeams } from "./jobs/standings";
import { ingestPlayerStats, ingestTeamStats } from "./jobs/stats";

function parseArgs(argv: string[]) {
  const [job, ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    }
  }
  return { job, flags };
}

const str = (v: string | true | undefined) => (typeof v === "string" ? v : undefined);

/** Run a step, log a failure, keep going: one dead upstream should not stop the rest of a bundle. */
async function step(name: string, fn: () => Promise<number>): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    log(`${name} failed:`, (err as Error).message);
    return 0;
  }
}

async function main() {
  const { job, flags } = parseArgs(process.argv.slice(2));
  if (!job) {
    console.error("usage: pnpm ingest <teams|schedule|scores|standings|boxscores|roster|stats|odds|advanced|today|nightly|backfill> [flags]");
    process.exit(2);
  }
  const holder = await getDb();
  const db = holder.db;
  log(`ingest ${job} (${holder.kind})`);
  const [run] = await db.insert(ingestRuns).values({ job, args: JSON.stringify(flags) }).returning({ id: ingestRuns.id });
  const today = todayPacific();
  const date = str(flags.date);
  const from = str(flags.from) ?? date;
  const to = str(flags.to) ?? date;
  if ((from && !isValidYmd(from)) || (to && !isValidYmd(to))) throw new Error("bad --date/--from/--to");
  let rows = 0;
  try {
    switch (job) {
      case "teams":
        rows = await ingestTeams(db);
        break;
      case "schedule":
        rows += await ingestClubSchedule(db);
        rows += await ingestLeagueSchedule(db, from ?? addDays(today, -3), to ?? addDays(today, 7));
        break;
      case "scores":
        rows = await ingestScores(db, [...dateRange(from ?? addDays(today, -1), to ?? today)]);
        break;
      case "standings":
        rows = from ? await ingestStandingsRange(db, [...dateRange(from, to ?? from)]) : await ingestStandings(db, today);
        break;
      case "boxscores":
        rows = await ingestBoxscores(db, {
          limit: flags.limit ? Number(flags.limit) : undefined,
          refresh: flags.refresh === true,
          game: flags.game ? Number(flags.game) : undefined,
        });
        break;
      case "roster":
        rows = await ingestRoster(db);
        if (flags.enrich === true) rows += await enrichPlayers(db);
        break;
      case "stats":
        rows += await ingestPlayerStats(db);
        rows += await ingestTeamStats(db);
        break;
      case "odds":
        rows = await ingestOdds(db);
        break;
      case "advanced":
        rows = await ingestAdvanced(db);
        break;
      case "today":
        rows += await step("scores", () => ingestScores(db, [addDays(today, -1), today, addDays(today, 1)]));
        rows += await step("boxscores", () => ingestBoxscores(db, { limit: 10 }));
        break;
      case "nightly":
        rows += await step("teams", () => ingestTeams(db));
        rows += await step("club schedule", () => ingestClubSchedule(db));
        rows += await step("league schedule", () => ingestLeagueSchedule(db, addDays(today, -3), addDays(today, 7)));
        rows += await step("scores", () => ingestScores(db, [addDays(today, -1), today]));
        rows += await step("standings", () => ingestStandingsRange(db, [addDays(today, -1), today]));
        rows += await step("roster", () => ingestRoster(db));
        rows += await step("stats", async () => (await ingestPlayerStats(db)) + (await ingestTeamStats(db)));
        rows += await step("odds", () => ingestOdds(db));
        rows += await step("advanced", () => ingestAdvanced(db));
        rows += await step("boxscores", () => ingestBoxscores(db));
        break;
      case "backfill": {
        const start = from ?? SEASON_START;
        const end = to ?? (today < SEASON_END ? addDays(today, 14) : SEASON_END);
        rows += await step("teams", () => ingestTeams(db));
        rows += await step("club schedule", () => ingestClubSchedule(db));
        rows += await step("league schedule", () => ingestLeagueSchedule(db, start, end));
        rows += await step("scores", () => ingestScores(db, [addDays(today, -1), today]));
        rows += await step("standings", () => ingestStandingsRange(db, [...dateRange(start, today < end ? today : end)]));
        rows += await step("roster", () => ingestRoster(db));
        rows += await step("players", () => enrichPlayers(db));
        rows += await step("stats", async () => (await ingestPlayerStats(db)) + (await ingestTeamStats(db)));
        rows += await step("odds", () => ingestOdds(db));
        rows += await step("advanced", () => ingestAdvanced(db));
        rows += await step("boxscores", () => ingestBoxscores(db, { limit: flags.limit ? Number(flags.limit) : undefined }));
        break;
      }
      default:
        throw new Error(`unknown job ${job}`);
    }
    await db.update(ingestRuns).set({ finishedAt: new Date(), ok: true, rows }).where(eq(ingestRuns.id, run.id));
    log(`${job}: done, ${rows} rows`);
  } catch (err) {
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), ok: false, rows, error: (err as Error).stack ?? String(err) })
      .where(eq(ingestRuns.id, run.id));
    console.error(err);
    process.exitCode = 1;
  } finally {
    await holder.close();
  }
}

main();
