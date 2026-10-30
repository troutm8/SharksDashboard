# Sharks 2026-27 — working notes

A personal dashboard for the San Jose Sharks' 2026-27 NHL season. Next.js 15 App Router,
Postgres via Drizzle, server-rendered from the database, live overlay from a proxy route.
Built on the pattern of `~/code/NCAAWomensVolleyball`; the conventions below are the same.

- What it does and how to deploy it: [README.md](README.md).
- Why it is built this way and what has been done so far: the build log at the end of
  [docs/PLAN.md](docs/PLAN.md). **Append to that log when you finish a piece of work.** It is
  the handoff between sessions and machines.

## Setting up a machine

```bash
npm install -g pnpm@10 --registry=https://registry.npmjs.org
pnpm install
pnpm db:migrate                # "(pglite)" locally, "(postgres)" with DATABASE_URL
pnpm ingest backfill           # about 30 seconds early in the season
pnpm dev                       # http://localhost:3000
```

Things that will otherwise cost an hour:

- **pnpm must be 10.** CI pins it and the lockfile is v9.
- **`package.json` allows esbuild's build script** via `pnpm.onlyBuiltDependencies`; tsx and
  vitest need it.
- **PGlite is single-process.** With no `DATABASE_URL`, the database is `.data/pglite` and one
  process may open it. Stop `pnpm dev` before running an ingest, or point `DATABASE_URL` at
  Neon where the restriction goes away.
- **`db:migrate` and `ingest` load `.env` themselves** (`--env-file-if-exists=.env`); an ad-hoc
  `pnpm tsx script.ts` does not, and will quietly use PGlite.

Environment: `DATABASE_URL` (unset → PGlite), `NEXT_PUBLIC_DISPLAY_TZ` (default
`America/Los_Angeles`), `FEATURED_TEAM_ID` (28) and `FEATURED_TEAM_ABBREV` (SJS),
`NHL_WEB_BASE`, `NHL_STATS_BASE`, `MONEYPUCK_BASE`.

## Commands

```bash
pnpm dev | build | start
pnpm typecheck                 # tsc --noEmit
pnpm test                      # vitest: parsers and derivations, no database
pnpm test:e2e                  # Playwright smoke tests against a server on :3000
pnpm db:migrate | db:generate

pnpm ingest today              # scores yesterday..tomorrow, then new Sharks box scores
pnpm ingest nightly            # everything that changes daily
pnpm ingest backfill           # whole season so far
pnpm ingest <teams|schedule|scores|standings|boxscores|roster|stats|odds|advanced> [flags]

node scripts/screenshots.mjs http://localhost:3000 screenshots
```

Run `pnpm typecheck && pnpm test && pnpm build` before committing; CI runs those, then the
Playwright smoke tests against the Neon database when the secret is present.

`pnpm test:e2e` reuses whatever is listening on port 3000. On this Mac that is often the
volleyball dashboard's dev server, and the suite then fails with 365 standings rows. Use
`PORT=3001 pnpm test:e2e` (Playwright starts `next start -p 3001` from the last `pnpm build`),
or `pnpm dev -p 3001` first to test against the dev server with one worker.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app` | Pages (server components, `force-dynamic`) and `/api/live` |
| `src/components` | `GameRow`, `LiveScoreboard`, `LiveGameCard` (client, poll `/api/live`), `ShotMap`, `Sparkline`, `TeamLogo`, `Headshot`, `Card` |
| `src/db` | Drizzle `schema.ts`, lazy `client.ts`, `migrate.ts` |
| `src/ingest` | `cli.ts`, `jobs/*`, `sources/{nhl-web,nhl-stats,moneypuck}.ts` (Zod), `fixtures/*` |
| `src/lib` | `queries.ts` (reads), `derive.ts` (pure: records, playoff picture, power rating), `live.ts`, `views.ts`, `season.ts`, `format.ts` |
| `e2e` | Playwright smoke tests |

## Conventions

- **Pure logic out of the database layer.** Records, splits, the wild-card picture, the power
  rating and the live merge are plain functions in `src/lib`, unit-tested without a database.
- **Validate at the boundary.** Every upstream payload goes through a Zod schema in
  `src/ingest/sources/` with a saved fixture; schemas are permissive about extra fields and
  strict about the ones we render.
- **Derive what can be derived; snapshot what the NHL computes.** Records and series come from
  stored games. Standings, season stat lines, odds and xG arrive computed and are stored as
  dated snapshots so history is free.
- **Sharks games only for box scores and play-by-play.** The `games` table holds every NHL game
  (for the scoreboard and standings context); `game_skater_stats`, `game_goalie_stats` and
  `game_events` are loaded only for games the featured team played. Widening that is a flag
  on `ingestBoxscores`, not a redesign.
- **Ids are the NHL's.** Teams by `teamId` (Sharks 28), players by `playerId`, games by the
  10-digit game id. No crosswalk. MoneyPuck team codes map through `TEAM_CODE_OVERRIDES`.
- **Dates.** `games.gameDate` is the NHL's (Eastern) date for the game; times are UTC and
  rendered in `DISPLAY_TZ`. "Today" is the Pacific date (`todayPacific`).
- Plain Tailwind. Tables use `class="data"`; the Sharks row gets `class="featured"`.

## Data sources, and how they misbehave

- `api-web.nhle.com/v1`: `/now` and `/current` paths 307-redirect to the dated URL; follow
  them. The week schedule omits `gameDate` on games, so the day's date is passed down. Game
  states: FUT, PRE, LIVE, CRIT, FINAL, OFF (`statusOf` collapses them). Cloudflare caches
  responses for 19 seconds, so the live poll is 20 seconds.
- `api.nhle.com/stats/rest/en`: `limit=-1` returns every row; `teamAbbrevs` is a comma list
  for traded players.
- MoneyPuck: CSVs with a `scenerio` column (sic); the `teams.csv` header repeats `team`. Files
  update overnight; the 06:00 Pacific cron catches them.
- Preseason games (`gameType` 1) are stored and hidden by default; box scores for them load
  too (the filter is on state, not type) and the season totals exclude them.

## Season calendar

Opening night 2026-09-29; All-Star break 2027-02-05/06; trade deadline 2027-03-01; regular
season ends 2027-04-10; playoffs from mid-April. Constants in `src/lib/season.ts`.
