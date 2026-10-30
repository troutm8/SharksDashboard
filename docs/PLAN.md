# San Jose Sharks Dashboard — 2026-27 Season Plan

Written 2026-10-30. Status: planning. Nothing built yet.

This plan deliberately follows the shape of the NCAA women's volleyball dashboard
(`~/code/NCAAWomensVolleyball`, docs/PLAN.md there): same stack, same conventions, same
"derive, validate at the boundary, hand-fix in committed files" discipline. Where hockey or
the NHL's data makes a different choice right, this document says so and why.

## 1. What we are building

A personal web dashboard for the 2026-27 NHL season, centered on the San Jose Sharks with
the rest of the league as context. It answers at a glance: are the Sharks playing right
now and what is the score, when is the next game and where can I watch it, how did the last
one go, where do they sit in the Pacific Division and the wild-card race, what are their
playoff odds. From there it drills into standings, league rankings, the roster and player
stats, team stats, every game's box score and shot map, and league leaders.

Assumptions (change them and the plan adjusts):

- Personal, non-commercial site. Database-backed. Hosting kept under $10/month, ideally $0
  on the same Neon and Vercel free tiers the volleyball site uses.
- Scope is the Sharks' 84-game regular season (2026-09-29 through 2027-04-10) and the
  playoffs if they get there. Preseason (gameType 1) is ingested but hidden by default.
- One developer, part-time. No hard external deadline, but the dashboard is most valuable
  early in the season, so the MVP should be live within two weeks.
- Data comes from the NHL's own public JSON endpoints, which are undocumented and
  unofficial-but-first-party, plus MoneyPuck's public CSVs for expected-goals and playoff
  odds. Attribute both, resell neither.

## 2. The 2026-27 calendar the dashboard has to follow

The first 84-game season since 1993-94. Dates verified 2026-10-30.

| Date | Event | Dashboard implication |
|---|---|---|
| 2026-09-29 | Opening night (earliest ever) | Season start for backfill |
| 2026-10-01 | Sharks home opener vs Florida, SAP Center | — |
| 2026-11-12, 11-14 | Global Series, Helsinki | Neutral-site and odd start times; check `neutralSite` and `venueTimezone` |
| 2026-12-18, 12-20 | Global Series, Düsseldorf | same |
| 2026-12-31 | Winter Classic, Salt Lake City | Outdoor game on the league scoreboard |
| 2027-02-05, 02-06 | All-Star Skills and Game, UBS Arena | Break: no Sharks games for about a week; home page shows the break instead of "no game today" |
| 2027-02-20 | Stadium Series, Dallas | — |
| 2027-03-01, 3 p.m. ET | Trade deadline | Roster churn: re-pull roster and player team assignments that night |
| 2027-04-10 | Regular season ends; Sharks host Anaheim | Standings freeze; playoff bracket or draft lottery mode |
| mid-April 2027 | Stanley Cup playoffs begin | Bracket page from the NHL playoff endpoints (verify in April) |
| May 2027 | Draft lottery | If the Sharks miss, the home page's "odds" card flips from playoffs to lottery |
| June 2027 | Stanley Cup Final | Season end; freeze and archive |

Sources: NBC Sports Bay Area key dates piece, Daily Faceoff on the trade deadline, NHL.com
Sharks schedule release, and the NHL API's own season record (`regularSeasonEndDate`
2027-04-10, `numberOfGames` 84). Links in section 10.

## 3. What goes on the dashboard

Ordered by priority. "MVP" ships first; "v1" follows once data is flowing; "v2" is for
December onward.

### Home / Today (MVP)
- **Game card.** If the Sharks are playing: live score, period and clock, shots on goal,
  scoring summary with assists, penalties, power play in progress, polled every 20 seconds.
  If not: the next game with a countdown, opponent record, venue, TV networks, and the
  season series so far. The card is the whole point of the page; build it first.
- **Last result.** Final score, goal scorers, three stars, Sharks goalie line, link to the
  box score.
- **Where we stand.** Record (W-L-OTL, points, points percentage), division place,
  wild-card position, games in hand versus the line, last 10, streak, goal differential.
- **Playoff odds** from MoneyPuck with a season sparkline. Flips to draft-lottery odds if
  the season goes that way; MoneyPuck publishes both in the same file.
- **Around the league tonight.** Every NHL game today, Sharks pinned to the top, live.
- **Season milestones** countdown (next Sharks home game, All-Star break, trade deadline,
  season finale).

### Scores and schedule (MVP)
- League scoreboard by date with a date picker; Sharks games pinned; filter to one team.
- Full Sharks schedule: 84 games by month, home/road, result or start time, broadcast.
- **Game page** for any NHL game: linescore by period, scoring and penalty summary, skater
  and goalie box score for both teams, team-stat comparison (shots, faceoffs, power play,
  hits, blocks, giveaways, takeaways), three stars, highlight-clip links from the
  play-by-play feed. Live games refresh.

### Standings (MVP)
- Division, conference, wild card and league views. Points, regulation wins (ROW tiebreak),
  points percentage, goal differential, home/road, last 10, streak. Sharks highlighted.
- **Playoff line.** For the wild-card view, show the cut line, points behind or ahead, and
  games in hand. This is what a fan actually reads in February.
- Standings history: the NHL API serves standings for any past date, so a daily snapshot
  table can be backfilled from opening night. Sharks points-pace and position charts come
  from it.

### Rankings (v1)
- **Power rating**, computed and published: a transparent blend of points percentage,
  goal differential per game, 5-on-5 expected-goals share and recent form, with the weights
  shown on the page exactly as the volleyball bracketology does. NHL.com's power rankings
  are editorial with no feed, so we make our own and show the inputs.
- **Playoff odds table** for all 32 teams from MoneyPuck: make playoffs, win division,
  win Cup, first-overall pick.
- Division and league rank of the Sharks in every team stat category (goals for and
  against per game, power play, penalty kill, shots, faceoffs, xG%).

### Roster and player stats (v1)
- Roster from the NHL API: headshots, number, position, age, height, weight, shoots.
- Sharks skater and goalie season tables, sortable: GP, G, A, P, +/-, PIM, PPG, SHG, GWG,
  shots, S%, TOI/GP, faceoff %; goalies GP, W-L-OTL, GAA, SV%, SO. Advanced columns from
  MoneyPuck (xG, on-ice xG%, Corsi%, game score) on a toggle.
- **Player page**: season totals, game log, rolling 10-game points chart, career totals by
  season from the player landing endpoint, last five games, draft details. Works for any
  NHL player, not only Sharks, so opponent box scores can link through.
- League leaders: goals, assists, points, plus-minus, PP goals, TOI; goalie wins, GAA,
  SV%, shutouts. Sharks players highlighted wherever they appear.

### Team stats (v1)
- Sharks season profile with league rank next to each number: GF/GP, GA/GP, PP%, PK%,
  shots for and against per game, faceoff %, 5-on-5 xG%, Corsi%, PDO.
- Per-game trend charts (goal differential, shots, xG) from the stored game log.
- Splits: home/road, by month, versus division, versus playoff teams, in one-goal games.
- Head-to-head versus each Pacific rival with the season series.

### Shot maps and play-by-play (v2)
- The play-by-play feed carries x/y coordinates and shot type for every shot attempt. An
  SVG rink with shot locations for a game, a player, or the season is a cheap and
  distinctive feature once the events are stored. Sharks games only, to keep the table
  small (about 280 events per game, under 25,000 rows for the season).
- Shift charts from the stats API if the appetite is there (about 700 rows per game).

### Playoffs or lottery (v2, by April 10)
- Bracket page from the NHL playoff endpoints once the field is set, auto-advancing from
  results. Verify the endpoints in early April; they are only populated in season.
- If the Sharks are out: draft lottery odds and the draft order as it firms up.

### Nice-to-have (v3)
- Push or email alert when a Sharks game starts, at the end of each period, and at the
  final.
- Goal highlight embeds (the play-by-play feed carries clip ids and sharing URLs).
- Barracuda (AHL) call-ups and recent transactions.
- Season archive with a `season` parameter so the site is reusable next year.

## 4. Data sources (verified 2026-10-30)

Everything below returned 200 with the shapes described, probed from this Mac today. The
NHL endpoints are undocumented, but have been stable since the NHL rebuilt them in late
2023 and are what NHL.com itself renders from. Expect them to change without notice anyway
and isolate them behind Zod schemas with saved fixtures, exactly as the volleyball project
does.

### NHL web API (`https://api-web.nhle.com/v1/…`)

`/now` and `/current` paths answer with a 307 redirect to the dated or season-stamped URL
(for example `/standings/now` becomes `/standings/2026-10-30`). Follow redirects; store the
resolved season (`20262027`) and date. Responses come through Cloudflare with
`cache-control: max-age=19`, so polling faster than every 20 seconds buys nothing.

| Need | Endpoint | Verified result |
|---|---|---|
| Sharks full schedule and results | `club-schedule-season/SJS/now` | 88 games (4 preseason + 84 regular), game states FUT/OFF/FINAL, venue, start UTC, TV networks, `neutralSite`, `gameScheduleState` |
| League scoreboard for a day, live | `score/now` or `score/YYYY-MM-DD` | Today's games with period, clock, scores, team leaders; `prevDate`/`nextDate` for paging |
| Week schedule for all teams | `schedule/now` | Seven days of every game |
| Standings, any date | `standings/now` or `standings/YYYY-MM-DD` | 32 rows, ~90 columns: points, ROW, division/conference/wild-card/league sequence, home/road/L10 splits, streak, logos |
| Season metadata | `standings-season` | Per-season flags (wild card in use, OT loss point, ties) and standings start/end dates |
| Sharks roster | `roster/SJS/current` | 15 F, 7 D, 2 G with headshot, bio, number, shoots |
| Sharks player season stats | `club-stats/SJS/now` | 22 skaters, 2 goalies with the standard season columns |
| Game box score | `gamecenter/{id}/boxscore` | Per-player G, A, P, +/-, PIM, hits, SOG, blocks, giveaways, takeaways, TOI, shifts; goalie save splits by strength |
| Game summary | `gamecenter/{id}/landing` | Scoring plays with assists, penalties, three stars, linescore, broadcasts |
| Game team stats and series | `gamecenter/{id}/right-rail` | Shots by period, team stat comparison, season series, game reports |
| Play-by-play | `gamecenter/{id}/play-by-play` | ~280 events per game with x/y coordinates, shot type, situation code, player ids, highlight clip ids |
| Player profile | `player/{id}/landing` | Bio, draft, featured season stats, career totals by season, last five games |
| Player game log | `player/{id}/game-log/20262027/2` | One row per game with the standard columns |
| League leaders | `skater-stats-leaders/current`, `goalie-stats-leaders/current` | Goals, assists, points, +/-, PP/SH goals, PIM, TOI, faceoffs; goalie GAA, SV%, shutouts, wins |

### NHL stats REST API (`https://api.nhle.com/stats/rest/en/…`)

Filtered with `cayenneExp=seasonId=20262027 and gameTypeId=2`. Paged with `start`/`limit`.

| Need | Endpoint | Verified result |
|---|---|---|
| Every skater's season line, league-wide | `skater/summary` | 732 skaters; sortable server-side; `teamAbbrevs` lists every team a traded player has played for |
| Every goalie's season line | `goalie/summary` | Same pattern (not probed, same family) |
| Team season stats | `team/summary` | 32 rows: GF/GA per game, PP%, PK%, shots for/against, faceoff %, regulation wins |
| Team game log | `team/summary?isGame=true&…teamId=28` | One row per Sharks game with the same columns |
| Shift charts | `shiftcharts?cayenneExp=gameId={id}` | ~700 shifts per game |
| Season list | `season` | Start, end, regular-season end, games per season |
| Team ids | `team` | Sharks are `teamId` 28, `triCode` SJS |

### MoneyPuck (`https://moneypuck.com/moneypuck/…`)

Public CSVs, refreshed daily. Attribute on every page that uses them.

| Need | File | Verified result |
|---|---|---|
| Playoff, division, Cup and lottery odds | `simulations/simulations_recent.csv` | One row per team per scenario (ALL, WINREG, LOSSOT, …); use `ALL` |
| Team advanced stats | `playerData/seasonSummary/2026/regular/teams.csv` | 160 rows (32 teams × situations: all, 5on5, 5on4, 4on5, other) with xG, Corsi, Fenwick, PDO inputs |
| Skater advanced stats | `playerData/seasonSummary/2026/regular/skaters.csv` | 3,660 rows (players × situations), 2.5 MB; game score, on/off-ice xG%, individual xG |

Team codes matched the NHL tricode (SJS) this season; older MoneyPuck files used `S.J`,
`L.A`, `N.J`, `T.B`. Keep a committed `data/team-code-overrides.csv` for the day they
disagree. MoneyPuck's power rankings CSV returned 404, so power rankings are computed here.

### Not available, do not plan on them
- NHL.com editorial power rankings and Super 16: no feed.
- Injuries and transactions: no NHL endpoint; would need scraping. Out of scope.
- Betting lines: out of scope.
- The `teamLeaders` block on `score/now` is thin; use `club-stats` and the leaders endpoints.

### Differences from the volleyball project worth naming
- **One first-party source instead of two unofficial ones.** NHL player and team ids are
  canonical everywhere in the NHL feeds, so there is no identity crosswalk to build. The
  only mapping is MoneyPuck team codes, and today it is the identity.
- **Standings arrive computed, with history on demand.** The volleyball site derives
  standings because no feed has them; here the NHL serves official standings with ROW
  tiebreaks for any date. Store daily snapshots rather than recompute, and backfill the
  snapshots from 2026-09-29.
- **Live data is richer and cheaper.** The 19-second cache on the score feed and the
  play-by-play endpoint mean a live game card with scoring plays is a proxy route, not a
  database job.

## 5. Technology choices

Same stack as the volleyball dashboard, on purpose: it works, it is free to host, and the
patterns (lazy DB client, per-host rate-limited fetch, ingest CLI with run logging, Zod at
the boundary, Playwright smoke tests against the live database) carry over by copying.

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript, server components, `force-dynamic` pages | Copy `next.config.ts`, `tsconfig.json`, `postcss.config.mjs` |
| UI | Tailwind 4, no component library | Copy `Card`, `Sparkline`, the `table.data` styles; teal (`#006D75`) and black as the palette |
| Charts | Inline SVG (sparklines, rolling charts, shot-map rink) | Same as volleyball; a rink is a few paths |
| Database | Postgres: PGlite locally, Neon in production, Drizzle ORM | Second Neon project, or a second database in the existing one, both free |
| Validation | Zod schemas per endpoint, fixtures saved in `src/ingest/fixtures/` | Today's probe JSONs become the first fixtures |
| Ingestion | tsx CLI, GitHub Actions cron | Nightly full; game-day every 15 minutes 4 p.m. to midnight Pacific; MoneyPuck once a day |
| Live scores | `/api/live` route proxying `score/{date}` and `gamecenter/{id}/landing` with a 20-second revalidate; client polls | Finals persisted by the next ingest, as in volleyball |
| Hosting | Vercel hobby, functions pinned to `iad1` beside Neon | Project name must be lowercase: `sharks-dashboard` |
| Testing | Vitest for parsers and derivations; Playwright smoke tests on the main routes, Chromium | Copy `playwright.config.ts` and the CI gating on `DATABASE_URL` |

Not shared as a package: copy the files. A shared library between two personal sites is
more ceremony than it saves, and the two will drift in sport-specific ways anyway.

Alternatives considered and rejected, briefly: a static site regenerated by Actions (loses
the per-game drilldown and history cheaply); Python/Streamlit (weak at live); a third-party
hockey API wrapper (adds a dependency between us and the same undocumented endpoints).

## 6. Data model (Postgres)

Ids are NHL ids throughout. Season is `20262027` as an integer, so a `season` column makes
next year a parameter rather than a rewrite.

- `teams` (id, abbrev, name, common_name, place_name, conference, division, logo_url,
  logo_dark_url) from the standings feed. 32 rows.
- `games` (id, season, game_type, game_date, start_time_utc, venue, venue_tz, neutral_site,
  home_team_id, away_team_id, home_score, away_score, home_sog, away_sog, game_state,
  schedule_state, period, period_type, clock, last_period_type (REG/OT/SO), broadcasts
  jsonb, boxscore_loaded, pbp_loaded, updated_at). Every NHL game, not only Sharks, so the
  league scoreboard and any game page work.
- `game_skater_stats` and `game_goalie_stats` (game_id, player_id, team_id, columns from the
  box score). Loaded for every final game league-wide; about 1,300 games × 40 rows is
  manageable, and it makes any player's game log derivable.
- `game_events` (game_id, event_id, sort_order, period, time_in_period, type, situation_code,
  team_id, player ids, x, y, zone, shot_type, details jsonb). Sharks games only in v2.
- `standings_snapshots` (date, team_id, every standings column). Daily from 2026-09-29.
- `players` (id, first_name, last_name, position, sweater_number, team_id, headshot_url,
  birth_date, birth_city, birth_country, height_in, weight_lb, shoots_catches, draft jsonb,
  updated_at). Upserted from rosters and box scores.
- `player_season_stats` (season, player_id, team_abbrevs, snapshot_date, columns from
  `skater/summary` or `goalie/summary`, scope skater|goalie). Latest row is the table;
  weekly snapshots give trend lines.
- `team_season_stats` (season, team_id, snapshot_date, columns from `team/summary`).
- `advanced_team_stats` (season, team_id, situation, snapshot_date, xg_for, xg_against,
  corsi_pct, fenwick_pct, …) from MoneyPuck.
- `advanced_skater_stats` (season, player_id, situation, snapshot_date, …) from MoneyPuck,
  Sharks players and league top 100 only, to keep the daily load small.
- `odds_snapshots` (date, team_id, make_playoffs, win_division, win_cup, first_overall,
  lottery, wildcard1, wildcard2, projected_points) from MoneyPuck.
- `ingest_runs` (job, args, started_at, finished_at, ok, rows, error), as in volleyball.

Derived, never stored: Sharks record splits (home/road, month, division, one-goal),
streaks, season series, points pace and projected points, games in hand, magic and tragic
numbers, player per-game rates and rolling averages, the power rating.

## 7. Build steps

Dates assume a start on 2026-10-31 and a part-time pace. Each phase ends with something
deployed. Use the volleyball repo as the template at every step; where a file is
sport-agnostic, copy it and adjust the names.

### Phase 0 — Scaffold (Oct 31 to Nov 2)
1. `pnpm create next-app` with TypeScript, Tailwind, App Router. Copy `.npmrc`, the pnpm 10
   pin and `onlyBuiltDependencies` from volleyball. Write `CLAUDE.md` and `README.md` in the
   same shape, pointing at this plan.
2. Copy `src/db/client.ts`, `src/db/migrate.ts`, `drizzle.config.ts`, `src/ingest/http.ts`
   (change the host gap table: `api-web.nhle.com` 100 ms, `api.nhle.com` 100 ms,
   `moneypuck.com` 1,000 ms), `src/ingest/cli.ts` skeleton, `vitest.config.mts`,
   `playwright.config.ts`, both GitHub workflows, `vercel.json`.
3. Write `src/db/schema.ts` from section 6; generate migration 0000.
4. Provision Neon, deploy the empty app to Vercel as `sharks-dashboard`, connect git.

### Phase 1 — Data in (Nov 2 to Nov 8)
5. Zod schemas in `src/ingest/sources/nhl-web.ts`, `nhl-stats.ts`, `moneypuck.ts`. Save the
   probe payloads from this session as fixtures; write parser tests against them.
6. Ingest jobs: `teams`, `schedule` (league week + Sharks season), `scores --date`,
   `standings --date` (snapshot, backfillable), `boxscores` (final games lacking one),
   `roster`, `player-stats` (league skater and goalie summary), `team-stats`, `odds`,
   `advanced`. Bundles: `today`, `nightly`, `backfill`.
7. Run `backfill` locally against PGlite, then against Neon via the Actions workflow.
8. GitHub Actions crons: nightly 04:17 Pacific; game-day every 15 minutes 16:00 to 23:59
   Pacific (`today` job: scores and boxscores only); MoneyPuck once at 06:00 Pacific
   (their files update overnight).

### Phase 2 — MVP pages (Nov 8 to Nov 15)
9. Home with the game card, `/api/live` proxy, next and last game, standing, odds,
   tonight's league slate, milestones.
10. `/scores?date=`, `/schedule`, `/games/[id]` with linescore, summary and box score.
11. `/standings` with division, conference, wild card and league views and the playoff line.
12. Mobile pass, dark mode, Playwright smoke tests on these routes, ship.

### Phase 3 — Players and team stats (Nov 15 to Nov 29)
13. `/roster`, `/players/[id]` with game log and rolling chart, `/stats` league leaders.
14. `/team` season profile with league ranks, trends and splits.
15. Standings history charts from the snapshots.

### Phase 4 — Rankings, odds and shot maps (December)
16. `/rankings`: computed power rating with published weights and the MoneyPuck odds table.
17. Play-by-play ingestion for Sharks games; SVG rink shot maps on game and player pages.
18. Unit tests for every derivation (record splits, pace, magic numbers, power rating).

### Phase 5 — Deadline and spring (March to June 2027)
19. Trade-deadline night: roster re-pull job, player team changes handled in the UI.
20. Verify the NHL playoff bracket endpoints in early April and build the bracket page, or
    the lottery page, by April 10.
21. Season freeze and archive with a `season` parameter.

## 8. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| NHL changes a payload shape mid-season | Medium (stable since 2023, but undocumented) | Zod at the boundary, fixtures, one adapter file per source, ingest fails loudly, UI keeps serving the last good rows |
| MoneyPuck changes column names or team codes | Medium | Separate adapter; committed code-override CSV; the site degrades to "odds unavailable" rather than erroring |
| Live card lags or shows stale clock | Low | Respect the 19-second upstream cache; show "updated N seconds ago"; fall back to server-rendered state |
| Postponements and reschedules | Certain over 84 games | Read `gameScheduleState`; re-pull the Sharks season schedule nightly, not only the week |
| Trades move players between teams | Certain | Player rows carry current team; game stats carry the team at game time; `teamAbbrevs` from the stats API lists all |
| Global Series and outdoor games break assumptions about venue and time zone | Low | Store `venueTimezone` and `neutralSite`; render in the viewer's zone |
| PGlite corruption from two processes | Medium (it happened on the volleyball project) | Same rule: stop `pnpm dev` before any ingest; prefer `DATABASE_URL` to Neon |
| GitHub Actions cron drift during games | Medium | Live view does not depend on the cron; the cron only persists finals |
| Terms-of-use exposure | Low for personal use | Non-commercial, attributed, no redistribution API |

## 9. Decisions (made 2026-10-30)

1. Audience: just the owner. No auth, hobby tiers.
2. Display time zone: `America/Los_Angeles`.
3. MoneyPuck: in, attributed on every page that uses it.
4. Shot maps and play-by-play: in from the start, not deferred to v2.
5. Box scores and play-by-play for Sharks games only; every NHL game's schedule and score is
   still stored. Widening to the league later is a flag on the box-score job.
6. Neon: a new project, separate from the volleyball database.

## 10. Sources checked for this plan

- Live probes on 2026-10-30 of every endpoint in section 4; the raw payloads are saved as
  future fixtures.
- [NHL key dates 2026-27 (NBC Sports Bay Area)](https://www.nbcsportsbayarea.com/nhl/nhl-key-dates-2026-27-opening-night-all-star-game/1963904/)
- [2026-27 trade deadline set for Monday, March 1 (Daily Faceoff)](https://www.dailyfaceoff.com/news/2026-27-nhl-trade-deadline-set-monday-march-1-news)
- [NHL unveils 2026-27 schedule, first 84-game season since 1993-94 (theScore)](https://thescore.com/nhl/news/3566950)
- [Sharks announce 2026-27 regular season schedule (NHL.com)](https://www.nhl.com/sharks/news/sharks-announce-2026-27-regular-season-schedule)
- [Sharks 2026-27 home opener announced (The Hockey News)](https://thehockeynews.com/nhl/san-jose-sharks/latest-news/san-jose-sharks-2026-27-home-opener-announced)

## 11. Build log and deviations from the plan

Append here when a piece of work is finished, as the volleyball project does. This is the
handoff between sessions and machines.

**2026-10-30.** Plan written. NHL and MoneyPuck endpoints probed and verified; nothing built.

**2026-10-30, later.** Phases 0 through 4 built in one session on the Mac, against PGlite.
Everything in sections 3 and 7 except the playoff bracket exists and renders from real data.

What was built:

- **Schema** (`src/db/schema.ts`): `teams`, `games` (every NHL game), `players`,
  `game_skater_stats`, `game_goalie_stats`, `game_events` (play-by-play with coordinates),
  `standings_snapshots` (daily), `skater_season_stats` and `goalie_season_stats` (league-wide
  daily snapshots), `team_season_stats`, `advanced_team_stats` and `advanced_skater_stats`
  (MoneyPuck), `odds_snapshots`, `ingest_runs`. One migration.
- **Ingest** (`src/ingest`): three Zod adapters with 22 fixtures from the probes; jobs for
  teams, schedule (club season plus league weeks), scores, standings (any date), box scores
  (box score + landing summary + play-by-play in one load), roster (with player landing
  enrichment), stats, odds, advanced; bundles `today`, `nightly`, `backfill`. A full backfill
  of the season to date took 32 seconds: 32 teams, 88 Sharks games plus the league schedule
  through mid-November, 32 days of standings, 24 roster players, 732 skaters and 71 goalies,
  160 MoneyPuck team rows and 110 skater rows, 18 box scores (14 regular season, 4 preseason).
- **Pages**: home (live game card with scoring plays, next and last game, standing, playoff
  line, odds with sparkline, tonight's slate, milestones), scores by date, schedule by month
  with running record, game page (linescore with shots, scoring, penalties, three stars, both
  box scores, goalies, team-stat comparison, shot map, season series), standings (division,
  wild card with cut line and points versus the line, conference, league), roster (standard
  and MoneyPuck columns, bios with draft details), player (season line, cumulative and
  rolling-10 charts, advanced numbers, season shot map, game log), team (league ranks for
  every stat, 5-on-5 and all-situation xG, splits, trends, division series, season shot
  map), stats (league leaders, sortable, position filter, goalie workload minimum), rankings
  (computed power rating with published weights, MoneyPuck odds table).
- **Live**: `/api/live` proxies the NHL score feed (a day) or a game's landing page (score,
  clock, scoring summary), cached 20 seconds. `LiveScoreboard` and `LiveGameCard` poll it
  every 20 seconds when a game is live or within 15 minutes of starting, every five minutes
  otherwise, never once everything is final. `pollInterval` and `mergeLive` are pure and
  tested.
- **Tests**: 31 Vitest tests (parsers on fixtures, record and split derivations, the wild-card
  picture, the power rating, the live merge); 14 Playwright smoke tests on every route.
- **Ops**: CI workflow (typecheck, test, build, then smoke tests when `DATABASE_URL` is set)
  and the ingest workflow (nightly 04:17 Pacific, MoneyPuck 07:40, scores every 15 minutes
  from 16:00 to midnight Pacific).

Deviations from the plan above, and why:

- **Standings rows carry no team id.** The standings feed identifies teams by tricode only,
  so `NHL_TEAM_IDS` in `src/ingest/jobs/standings.ts` is a committed tricode-to-id map, with
  the week schedule consulted first so an expansion team would still resolve.
- **The week schedule omits `gameDate`.** Forty-eight of the games in the first probe had
  none. `gameDateOf` takes the day the feed lists the game under, falling back to the
  Eastern date of the start time.
- **Game summaries are stored on the game row** as JSON (goals with assists, penalties,
  three stars) rather than derived from events, so the home page and game page read one row
  and the live card can show the same shape straight from the proxy.
- **MoneyPuck skater rows are Sharks-only**, not Sharks plus a league top 100: the roster and
  player pages are the only consumers, and the file is 2.5 MB a day as it is.
- **Preseason box scores load too.** The box-score job filters on game state, not type, so
  the four preseason games have box scores and events; season totals exclude them by type.
- **Standings history is a points sparkline, not a position chart.** Position needs the
  wild-card order per day, which is in the snapshots; a chart of it is a small follow-up.

Still to do, in order: create the Neon project and set `DATABASE_URL` as the GitHub secret
and Vercel variable; first commit and push, connect Vercel to the repository, deploy; run the
backfill workflow once; the playoff bracket or lottery page by April 10; a standings-position
chart; the heavy season shot map on `/team` (about 1,300 points, each with a tooltip) could
drop its tooltips if the page feels slow.
