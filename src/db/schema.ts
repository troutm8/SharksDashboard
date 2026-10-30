import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** NHL game ids (2026020213) are 10 digits: bigint, read back as a JS number. */
const gameId = (name: string) => bigint(name, { mode: "number" });

/** One row per NHL club, from the standings feed. Keyed by the NHL team id (Sharks = 28). */
export const teams = pgTable("teams", {
  id: integer("id").primaryKey(),
  abbrev: text("abbrev").notNull(),
  name: text("name").notNull(), // "San Jose Sharks"
  commonName: text("common_name").notNull(), // "Sharks"
  placeName: text("place_name").notNull(), // "San Jose"
  conference: text("conference"),
  division: text("division"),
  logoUrl: text("logo_url"),
  logoDarkUrl: text("logo_dark_url"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Broadcast = { network: string; market: string; countryCode: string };

export type ThreeStar = {
  star: number;
  playerId: number;
  teamAbbrev: string;
  name: string;
  sweaterNumber: number | null;
  position: string;
  goals: number | null;
  assists: number | null;
  points: number | null;
  savePctg: number | null;
  goalsAgainst: number | null;
};

export type GoalSummary = {
  period: number;
  periodType: string;
  timeInPeriod: string;
  teamAbbrev: string;
  strength: string;
  playerId: number;
  scorer: string;
  goalsToDate: number | null;
  assists: { playerId: number; name: string; assistsToDate: number | null }[];
  homeScore: number;
  awayScore: number;
  shotType: string | null;
  highlightUrl: string | null;
};

export type PenaltySummary = {
  period: number;
  periodType: string;
  timeInPeriod: string;
  teamAbbrev: string;
  type: string;
  duration: number | null;
  committedBy: string | null;
  drawnBy: string | null;
  descKey: string;
};

export type GameSummary = { goals: GoalSummary[]; penalties: PenaltySummary[]; threeStars: ThreeStar[] };

/**
 * Every NHL game of the season (schedule and scores for the league scoreboard and
 * standings context). Box scores and play-by-play are loaded for Sharks games only.
 */
export const games = pgTable(
  "games",
  {
    id: gameId("id").primaryKey(),
    season: integer("season").notNull(),
    gameType: integer("game_type").notNull(), // 1 pre, 2 regular, 3 playoffs
    /** The NHL's calendar date for the game (Eastern). */
    gameDate: date("game_date").notNull(),
    startTimeUtc: timestamp("start_time_utc", { withTimezone: true }),
    venue: text("venue"),
    venueTimezone: text("venue_timezone"),
    neutralSite: boolean("neutral_site"),
    homeTeamId: integer("home_team_id").notNull().references(() => teams.id),
    awayTeamId: integer("away_team_id").notNull().references(() => teams.id),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    homeSog: integer("home_sog"),
    awaySog: integer("away_sog"),
    /** Raw NHL state: FUT, PRE, LIVE, CRIT, FINAL, OFF. */
    gameState: text("game_state").notNull(),
    /** OK, TBD, PPD (postponed), SUSP, CNCL. */
    scheduleState: text("schedule_state"),
    period: integer("period"),
    periodType: text("period_type"),
    clock: text("clock"),
    inIntermission: boolean("in_intermission"),
    /** REG, OT or SO once final. */
    lastPeriodType: text("last_period_type"),
    broadcasts: jsonb("broadcasts").$type<Broadcast[]>(),
    summary: jsonb("summary").$type<GameSummary>(),
    boxscoreLoaded: boolean("boxscore_loaded").notNull().default(false),
    pbpLoaded: boolean("pbp_loaded").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("games_date_idx").on(t.gameDate), index("games_home_idx").on(t.homeTeamId), index("games_away_idx").on(t.awayTeamId)],
);

export type DraftDetails = { year: number; teamAbbrev: string; round: number; pickInRound: number; overallPick: number };

/** Anyone who has appeared on a roster or in a loaded box score. */
export const players = pgTable("players", {
  id: integer("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  position: text("position"), // C, L, R, D, G
  sweaterNumber: integer("sweater_number"),
  teamId: integer("team_id").references(() => teams.id),
  headshotUrl: text("headshot_url"),
  birthDate: date("birth_date"),
  birthCity: text("birth_city"),
  birthCountry: text("birth_country"),
  heightIn: integer("height_in"),
  weightLb: integer("weight_lb"),
  shootsCatches: text("shoots_catches"),
  draft: jsonb("draft").$type<DraftDetails>(),
  /** True for the current Sharks roster; cleared when a roster pull no longer lists them. */
  onRoster: boolean("on_roster").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameSkaterStats = pgTable(
  "game_skater_stats",
  {
    gameId: gameId("game_id").notNull().references(() => games.id),
    playerId: integer("player_id").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    name: text("name").notNull(),
    sweaterNumber: integer("sweater_number"),
    position: text("position"),
    goals: integer("goals"),
    assists: integer("assists"),
    points: integer("points"),
    plusMinus: integer("plus_minus"),
    pim: integer("pim"),
    hits: integer("hits"),
    ppGoals: integer("pp_goals"),
    sog: integer("sog"),
    faceoffPct: numeric("faceoff_pct", { precision: 6, scale: 4 }),
    toiSeconds: integer("toi_seconds"),
    blockedShots: integer("blocked_shots"),
    shifts: integer("shifts"),
    giveaways: integer("giveaways"),
    takeaways: integer("takeaways"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.playerId] }), index("gss_player_idx").on(t.playerId), index("gss_team_idx").on(t.teamId)],
);

export const gameGoalieStats = pgTable(
  "game_goalie_stats",
  {
    gameId: gameId("game_id").notNull().references(() => games.id),
    playerId: integer("player_id").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    name: text("name").notNull(),
    sweaterNumber: integer("sweater_number"),
    starter: boolean("starter"),
    decision: text("decision"), // W, L, O
    shotsAgainst: integer("shots_against"),
    saves: integer("saves"),
    goalsAgainst: integer("goals_against"),
    savePctg: numeric("save_pctg", { precision: 6, scale: 4 }),
    evShotsAgainst: text("ev_shots_against"), // "17/19" as the NHL gives it
    ppShotsAgainst: text("pp_shots_against"),
    shShotsAgainst: text("sh_shots_against"),
    evGoalsAgainst: integer("ev_goals_against"),
    ppGoalsAgainst: integer("pp_goals_against"),
    shGoalsAgainst: integer("sh_goals_against"),
    pim: integer("pim"),
    toiSeconds: integer("toi_seconds"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.playerId] }), index("ggs_player_idx").on(t.playerId)],
);

/** Play-by-play events for Sharks games: shots, goals, hits, faceoffs, penalties and so on. */
export const gameEvents = pgTable(
  "game_events",
  {
    gameId: gameId("game_id").notNull().references(() => games.id),
    eventId: integer("event_id").notNull(),
    sortOrder: integer("sort_order").notNull(),
    period: integer("period").notNull(),
    periodType: text("period_type").notNull(),
    timeInPeriod: text("time_in_period").notNull(),
    timeRemaining: text("time_remaining"),
    typeCode: integer("type_code").notNull(),
    typeDescKey: text("type_desc_key").notNull(),
    situationCode: text("situation_code"),
    homeDefendingSide: text("home_defending_side"),
    teamId: integer("team_id"),
    x: integer("x"),
    y: integer("y"),
    zone: text("zone"),
    shotType: text("shot_type"),
    /** Shooter, scorer, hitter, faceoff winner, penalised player. */
    player1Id: integer("player1_id"),
    /** First assist, hittee, faceoff loser, player who drew the penalty. */
    player2Id: integer("player2_id"),
    /** Second assist, blocker. */
    player3Id: integer("player3_id"),
    goalieId: integer("goalie_id"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    details: jsonb("details").$type<Record<string, unknown>>(),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.eventId] }), index("ge_type_idx").on(t.typeDescKey), index("ge_player_idx").on(t.player1Id)],
);

/** Official standings, one snapshot per team per day, backfilled from opening night. */
export const standingsSnapshots = pgTable(
  "standings_snapshots",
  {
    date: date("date").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    season: integer("season").notNull(),
    gamesPlayed: integer("games_played").notNull(),
    wins: integer("wins").notNull(),
    losses: integer("losses").notNull(),
    otLosses: integer("ot_losses").notNull(),
    points: integer("points").notNull(),
    pointPctg: numeric("point_pctg", { precision: 7, scale: 6 }),
    regulationWins: integer("regulation_wins"),
    regulationPlusOtWins: integer("regulation_plus_ot_wins"),
    goalsFor: integer("goals_for"),
    goalsAgainst: integer("goals_against"),
    goalDifferential: integer("goal_differential"),
    homeWins: integer("home_wins"),
    homeLosses: integer("home_losses"),
    homeOtLosses: integer("home_ot_losses"),
    roadWins: integer("road_wins"),
    roadLosses: integer("road_losses"),
    roadOtLosses: integer("road_ot_losses"),
    l10Wins: integer("l10_wins"),
    l10Losses: integer("l10_losses"),
    l10OtLosses: integer("l10_ot_losses"),
    streakCode: text("streak_code"),
    streakCount: integer("streak_count"),
    shootoutWins: integer("shootout_wins"),
    shootoutLosses: integer("shootout_losses"),
    divisionSequence: integer("division_sequence"),
    conferenceSequence: integer("conference_sequence"),
    leagueSequence: integer("league_sequence"),
    /** 0 for the division's top three, otherwise the wild-card order within the conference. */
    wildcardSequence: integer("wildcard_sequence"),
  },
  (t) => [primaryKey({ columns: [t.date, t.teamId] }), index("standings_team_idx").on(t.teamId)],
);

/** League-wide skater season lines from the stats API. The latest snapshot is the table. */
export const skaterSeasonStats = pgTable(
  "skater_season_stats",
  {
    season: integer("season").notNull(),
    playerId: integer("player_id").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    fullName: text("full_name").notNull(),
    teamAbbrevs: text("team_abbrevs"),
    position: text("position"),
    shootsCatches: text("shoots_catches"),
    gamesPlayed: integer("games_played"),
    goals: integer("goals"),
    assists: integer("assists"),
    points: integer("points"),
    plusMinus: integer("plus_minus"),
    pim: integer("pim"),
    ppGoals: integer("pp_goals"),
    ppPoints: integer("pp_points"),
    shGoals: integer("sh_goals"),
    shPoints: integer("sh_points"),
    evGoals: integer("ev_goals"),
    evPoints: integer("ev_points"),
    gwGoals: integer("gw_goals"),
    otGoals: integer("ot_goals"),
    shots: integer("shots"),
    shootingPct: numeric("shooting_pct", { precision: 7, scale: 5 }),
    toiPerGame: numeric("toi_per_game", { precision: 8, scale: 3 }),
    faceoffWinPct: numeric("faceoff_win_pct", { precision: 7, scale: 5 }),
    pointsPerGame: numeric("points_per_game", { precision: 7, scale: 5 }),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerId, t.snapshotDate] }), index("sss_date_idx").on(t.snapshotDate)],
);

export const goalieSeasonStats = pgTable(
  "goalie_season_stats",
  {
    season: integer("season").notNull(),
    playerId: integer("player_id").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    fullName: text("full_name").notNull(),
    teamAbbrevs: text("team_abbrevs"),
    gamesPlayed: integer("games_played"),
    gamesStarted: integer("games_started"),
    wins: integer("wins"),
    losses: integer("losses"),
    otLosses: integer("ot_losses"),
    shotsAgainst: integer("shots_against"),
    saves: integer("saves"),
    goalsAgainst: integer("goals_against"),
    gaa: numeric("gaa", { precision: 7, scale: 5 }),
    savePct: numeric("save_pct", { precision: 7, scale: 5 }),
    shutouts: integer("shutouts"),
    toiSeconds: integer("toi_seconds"),
    assists: integer("assists"),
    goals: integer("goals"),
    pim: integer("pim"),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerId, t.snapshotDate] }), index("gss2_date_idx").on(t.snapshotDate)],
);

/** Team season totals from the stats API, one snapshot per day. */
export const teamSeasonStats = pgTable(
  "team_season_stats",
  {
    season: integer("season").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    snapshotDate: date("snapshot_date").notNull(),
    gamesPlayed: integer("games_played"),
    wins: integer("wins"),
    losses: integer("losses"),
    otLosses: integer("ot_losses"),
    points: integer("points"),
    pointPct: numeric("point_pct", { precision: 7, scale: 5 }),
    goalsFor: integer("goals_for"),
    goalsAgainst: integer("goals_against"),
    goalsForPerGame: numeric("goals_for_per_game", { precision: 7, scale: 5 }),
    goalsAgainstPerGame: numeric("goals_against_per_game", { precision: 7, scale: 5 }),
    ppPct: numeric("pp_pct", { precision: 7, scale: 6 }),
    pkPct: numeric("pk_pct", { precision: 7, scale: 6 }),
    ppNetPct: numeric("pp_net_pct", { precision: 7, scale: 6 }),
    pkNetPct: numeric("pk_net_pct", { precision: 7, scale: 6 }),
    shotsForPerGame: numeric("shots_for_per_game", { precision: 7, scale: 5 }),
    shotsAgainstPerGame: numeric("shots_against_per_game", { precision: 7, scale: 5 }),
    faceoffWinPct: numeric("faceoff_win_pct", { precision: 7, scale: 6 }),
    regulationAndOtWins: integer("regulation_and_ot_wins"),
    winsInRegulation: integer("wins_in_regulation"),
    winsInShootout: integer("wins_in_shootout"),
    shutouts: integer("shutouts"),
  },
  (t) => [primaryKey({ columns: [t.season, t.teamId, t.snapshotDate] })],
);

/** MoneyPuck team numbers by situation (all, 5on5, 5on4, 4on5, other). */
export const advancedTeamStats = pgTable(
  "advanced_team_stats",
  {
    season: integer("season").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    situation: text("situation").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    gamesPlayed: integer("games_played"),
    iceTime: numeric("ice_time", { precision: 10, scale: 1 }),
    xGoalsPct: numeric("x_goals_pct", { precision: 6, scale: 4 }),
    corsiPct: numeric("corsi_pct", { precision: 6, scale: 4 }),
    fenwickPct: numeric("fenwick_pct", { precision: 6, scale: 4 }),
    xGoalsFor: numeric("x_goals_for", { precision: 8, scale: 3 }),
    xGoalsAgainst: numeric("x_goals_against", { precision: 8, scale: 3 }),
    goalsFor: integer("goals_for"),
    goalsAgainst: integer("goals_against"),
    shotsOnGoalFor: integer("shots_on_goal_for"),
    shotsOnGoalAgainst: integer("shots_on_goal_against"),
    shotAttemptsFor: integer("shot_attempts_for"),
    shotAttemptsAgainst: integer("shot_attempts_against"),
    highDangerXGoalsFor: numeric("hd_x_goals_for", { precision: 8, scale: 3 }),
    highDangerXGoalsAgainst: numeric("hd_x_goals_against", { precision: 8, scale: 3 }),
    highDangerGoalsFor: integer("hd_goals_for"),
    highDangerGoalsAgainst: integer("hd_goals_against"),
  },
  (t) => [primaryKey({ columns: [t.season, t.teamId, t.situation, t.snapshotDate] })],
);

/** MoneyPuck skater numbers, Sharks players only for now. */
export const advancedSkaterStats = pgTable(
  "advanced_skater_stats",
  {
    season: integer("season").notNull(),
    playerId: integer("player_id").notNull(),
    situation: text("situation").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    name: text("name").notNull(),
    teamAbbrev: text("team_abbrev").notNull(),
    position: text("position"),
    gamesPlayed: integer("games_played"),
    iceTime: numeric("ice_time", { precision: 10, scale: 1 }),
    gameScore: numeric("game_score", { precision: 8, scale: 3 }),
    onIceXGoalsPct: numeric("on_ice_x_goals_pct", { precision: 6, scale: 4 }),
    offIceXGoalsPct: numeric("off_ice_x_goals_pct", { precision: 6, scale: 4 }),
    onIceCorsiPct: numeric("on_ice_corsi_pct", { precision: 6, scale: 4 }),
    iXGoals: numeric("i_x_goals", { precision: 8, scale: 3 }),
    iGoals: integer("i_goals"),
    iPrimaryAssists: integer("i_primary_assists"),
    iSecondaryAssists: integer("i_secondary_assists"),
    iPoints: integer("i_points"),
    iShotsOnGoal: integer("i_shots_on_goal"),
    iHighDangerXGoals: numeric("i_hd_x_goals", { precision: 8, scale: 3 }),
    iHits: integer("i_hits"),
    iTakeaways: integer("i_takeaways"),
    iGiveaways: integer("i_giveaways"),
    shotsBlocked: integer("shots_blocked"),
    onIceXGoalsFor: numeric("on_ice_x_goals_for", { precision: 8, scale: 3 }),
    onIceXGoalsAgainst: numeric("on_ice_x_goals_against", { precision: 8, scale: 3 }),
  },
  (t) => [primaryKey({ columns: [t.season, t.playerId, t.situation, t.snapshotDate] })],
);

/** MoneyPuck simulation odds, the "ALL" scenario, one row per team per day. */
export const oddsSnapshots = pgTable(
  "odds_snapshots",
  {
    date: date("date").notNull(),
    teamId: integer("team_id").notNull().references(() => teams.id),
    madePlayoffs: numeric("made_playoffs", { precision: 6, scale: 4 }),
    round2: numeric("round2", { precision: 6, scale: 4 }),
    round3: numeric("round3", { precision: 6, scale: 4 }),
    round4: numeric("round4", { precision: 6, scale: 4 }),
    wonCup: numeric("won_cup", { precision: 6, scale: 4 }),
    wonDivision: numeric("won_division", { precision: 6, scale: 4 }),
    firstOverall: numeric("first_overall", { precision: 6, scale: 4 }),
    draftLottery: numeric("draft_lottery", { precision: 6, scale: 4 }),
    wildcard1: numeric("wildcard1", { precision: 6, scale: 4 }),
    wildcard2: numeric("wildcard2", { precision: 6, scale: 4 }),
    projectedPoints: numeric("projected_points", { precision: 6, scale: 1 }),
  },
  (t) => [primaryKey({ columns: [t.date, t.teamId] })],
);

export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  job: text("job").notNull(),
  args: text("args"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  rows: integer("rows"),
  error: text("error"),
});

export type Team = typeof teams.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Player = typeof players.$inferSelect;
export type GameSkaterStat = typeof gameSkaterStats.$inferSelect;
export type GameGoalieStat = typeof gameGoalieStats.$inferSelect;
export type GameEvent = typeof gameEvents.$inferSelect;
export type StandingsRow = typeof standingsSnapshots.$inferSelect;
export type SkaterSeason = typeof skaterSeasonStats.$inferSelect;
export type GoalieSeason = typeof goalieSeasonStats.$inferSelect;
export type TeamSeason = typeof teamSeasonStats.$inferSelect;
export type AdvancedTeam = typeof advancedTeamStats.$inferSelect;
export type AdvancedSkater = typeof advancedSkaterStats.$inferSelect;
export type Odds = typeof oddsSnapshots.$inferSelect;
