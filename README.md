# Sharks 2026-27

Live at https://sharks-dashboard-tawny.vercel.app.

A personal dashboard for the San Jose Sharks' 2026-27 NHL season: the game of the day with
live score and scoring plays, the schedule and results, league scores, standings and the
wild-card race, roster and player pages with game logs and shot maps, team stats with league
ranks, league leaders, computed power rankings and MoneyPuck playoff odds.

Plan, data-source notes and the build log: [docs/PLAN.md](docs/PLAN.md). Working notes for
the next session: [CLAUDE.md](CLAUDE.md).

## How it works

- **Data sources** (unofficial, personal use): the NHL's public JSON feeds
  (`api-web.nhle.com` for schedule, scores, standings, rosters, box scores and play-by-play;
  `api.nhle.com/stats/rest` for league-wide season lines) and MoneyPuck's public CSVs for
  playoff odds and expected goals.
- **Database**: Postgres. Locally an embedded [PGlite](https://pglite.dev) file in
  `.data/pglite` when `DATABASE_URL` is unset; in production a Neon database.
- **Ingestion**: `pnpm ingest <job>` (see `src/ingest/cli.ts`). GitHub Actions runs it on a
  schedule (`.github/workflows/ingest.yml`): nightly full refresh, MoneyPuck after their
  overnight update, and score refreshes every 15 minutes through the evening.
- **Web app**: Next.js 15 App Router, server-rendered from the database. The home page,
  scores page and game pages overlay live state from `/api/live`, which proxies the NHL
  feed with a 20-second cache.
- **Shot maps** are drawn from the play-by-play coordinates stored for Sharks games.
- **Power rankings** are computed from points percentage, goal differential, 5-on-5
  expected-goals share and recent form, with the weights published on the page.

## Local development

```bash
pnpm install                  # pnpm 10
cp .env.example .env          # optional; defaults work with PGlite
pnpm db:migrate
pnpm ingest backfill          # the season so far, about 30 seconds in October
pnpm dev                      # http://localhost:3000
```

Day to day:

```bash
pnpm ingest today             # scores for yesterday, today, tomorrow; new box scores
pnpm ingest nightly           # schedule, scores, standings, roster, stats, odds, xG, box scores
pnpm ingest boxscores --refresh --game 2026020213
```

Checks: `pnpm typecheck`, `pnpm test`, `pnpm build`, then `pnpm test:e2e` against a running
server.

**One process at a time with PGlite.** Stop `pnpm dev` before running an ingest job, and vice
versa. With a real `DATABASE_URL` this restriction goes away.

## Deploying

1. Create a Postgres database on [Neon](https://neon.tech) and copy its connection string.
2. Add it as the `DATABASE_URL` secret in the GitHub repository, then run the **Ingest data**
   workflow manually with job `backfill`.
3. Import the repository in [Vercel](https://vercel.com), set `DATABASE_URL`, deploy. The
   functions are pinned to `iad1` in `vercel.json` to sit beside Neon's us-east-1.
