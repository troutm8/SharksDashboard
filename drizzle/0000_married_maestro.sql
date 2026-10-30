CREATE TABLE "advanced_skater_stats" (
	"season" integer NOT NULL,
	"player_id" integer NOT NULL,
	"situation" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"name" text NOT NULL,
	"team_abbrev" text NOT NULL,
	"position" text,
	"games_played" integer,
	"ice_time" numeric(10, 1),
	"game_score" numeric(8, 3),
	"on_ice_x_goals_pct" numeric(6, 4),
	"off_ice_x_goals_pct" numeric(6, 4),
	"on_ice_corsi_pct" numeric(6, 4),
	"i_x_goals" numeric(8, 3),
	"i_goals" integer,
	"i_primary_assists" integer,
	"i_secondary_assists" integer,
	"i_points" integer,
	"i_shots_on_goal" integer,
	"i_hd_x_goals" numeric(8, 3),
	"i_hits" integer,
	"i_takeaways" integer,
	"i_giveaways" integer,
	"shots_blocked" integer,
	"on_ice_x_goals_for" numeric(8, 3),
	"on_ice_x_goals_against" numeric(8, 3),
	CONSTRAINT "advanced_skater_stats_season_player_id_situation_snapshot_date_pk" PRIMARY KEY("season","player_id","situation","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "advanced_team_stats" (
	"season" integer NOT NULL,
	"team_id" integer NOT NULL,
	"situation" text NOT NULL,
	"snapshot_date" date NOT NULL,
	"games_played" integer,
	"ice_time" numeric(10, 1),
	"x_goals_pct" numeric(6, 4),
	"corsi_pct" numeric(6, 4),
	"fenwick_pct" numeric(6, 4),
	"x_goals_for" numeric(8, 3),
	"x_goals_against" numeric(8, 3),
	"goals_for" integer,
	"goals_against" integer,
	"shots_on_goal_for" integer,
	"shots_on_goal_against" integer,
	"shot_attempts_for" integer,
	"shot_attempts_against" integer,
	"hd_x_goals_for" numeric(8, 3),
	"hd_x_goals_against" numeric(8, 3),
	"hd_goals_for" integer,
	"hd_goals_against" integer,
	CONSTRAINT "advanced_team_stats_season_team_id_situation_snapshot_date_pk" PRIMARY KEY("season","team_id","situation","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"game_id" bigint NOT NULL,
	"event_id" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"period" integer NOT NULL,
	"period_type" text NOT NULL,
	"time_in_period" text NOT NULL,
	"time_remaining" text,
	"type_code" integer NOT NULL,
	"type_desc_key" text NOT NULL,
	"situation_code" text,
	"home_defending_side" text,
	"team_id" integer,
	"x" integer,
	"y" integer,
	"zone" text,
	"shot_type" text,
	"player1_id" integer,
	"player2_id" integer,
	"player3_id" integer,
	"goalie_id" integer,
	"home_score" integer,
	"away_score" integer,
	"details" jsonb,
	CONSTRAINT "game_events_game_id_event_id_pk" PRIMARY KEY("game_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "game_goalie_stats" (
	"game_id" bigint NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"sweater_number" integer,
	"starter" boolean,
	"decision" text,
	"shots_against" integer,
	"saves" integer,
	"goals_against" integer,
	"save_pctg" numeric(6, 4),
	"ev_shots_against" text,
	"pp_shots_against" text,
	"sh_shots_against" text,
	"ev_goals_against" integer,
	"pp_goals_against" integer,
	"sh_goals_against" integer,
	"pim" integer,
	"toi_seconds" integer,
	CONSTRAINT "game_goalie_stats_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "game_skater_stats" (
	"game_id" bigint NOT NULL,
	"player_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"name" text NOT NULL,
	"sweater_number" integer,
	"position" text,
	"goals" integer,
	"assists" integer,
	"points" integer,
	"plus_minus" integer,
	"pim" integer,
	"hits" integer,
	"pp_goals" integer,
	"sog" integer,
	"faceoff_pct" numeric(6, 4),
	"toi_seconds" integer,
	"blocked_shots" integer,
	"shifts" integer,
	"giveaways" integer,
	"takeaways" integer,
	CONSTRAINT "game_skater_stats_game_id_player_id_pk" PRIMARY KEY("game_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" bigint PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"game_type" integer NOT NULL,
	"game_date" date NOT NULL,
	"start_time_utc" timestamp with time zone,
	"venue" text,
	"venue_timezone" text,
	"neutral_site" boolean,
	"home_team_id" integer NOT NULL,
	"away_team_id" integer NOT NULL,
	"home_score" integer,
	"away_score" integer,
	"home_sog" integer,
	"away_sog" integer,
	"game_state" text NOT NULL,
	"schedule_state" text,
	"period" integer,
	"period_type" text,
	"clock" text,
	"in_intermission" boolean,
	"last_period_type" text,
	"broadcasts" jsonb,
	"summary" jsonb,
	"boxscore_loaded" boolean DEFAULT false NOT NULL,
	"pbp_loaded" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goalie_season_stats" (
	"season" integer NOT NULL,
	"player_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"full_name" text NOT NULL,
	"team_abbrevs" text,
	"games_played" integer,
	"games_started" integer,
	"wins" integer,
	"losses" integer,
	"ot_losses" integer,
	"shots_against" integer,
	"saves" integer,
	"goals_against" integer,
	"gaa" numeric(7, 5),
	"save_pct" numeric(7, 5),
	"shutouts" integer,
	"toi_seconds" integer,
	"assists" integer,
	"goals" integer,
	"pim" integer,
	CONSTRAINT "goalie_season_stats_season_player_id_snapshot_date_pk" PRIMARY KEY("season","player_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"args" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"rows" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "odds_snapshots" (
	"date" date NOT NULL,
	"team_id" integer NOT NULL,
	"made_playoffs" numeric(6, 4),
	"round2" numeric(6, 4),
	"round3" numeric(6, 4),
	"round4" numeric(6, 4),
	"won_cup" numeric(6, 4),
	"won_division" numeric(6, 4),
	"first_overall" numeric(6, 4),
	"draft_lottery" numeric(6, 4),
	"wildcard1" numeric(6, 4),
	"wildcard2" numeric(6, 4),
	"projected_points" numeric(6, 1),
	CONSTRAINT "odds_snapshots_date_team_id_pk" PRIMARY KEY("date","team_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" integer PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"position" text,
	"sweater_number" integer,
	"team_id" integer,
	"headshot_url" text,
	"birth_date" date,
	"birth_city" text,
	"birth_country" text,
	"height_in" integer,
	"weight_lb" integer,
	"shoots_catches" text,
	"draft" jsonb,
	"on_roster" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skater_season_stats" (
	"season" integer NOT NULL,
	"player_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"full_name" text NOT NULL,
	"team_abbrevs" text,
	"position" text,
	"shoots_catches" text,
	"games_played" integer,
	"goals" integer,
	"assists" integer,
	"points" integer,
	"plus_minus" integer,
	"pim" integer,
	"pp_goals" integer,
	"pp_points" integer,
	"sh_goals" integer,
	"sh_points" integer,
	"ev_goals" integer,
	"ev_points" integer,
	"gw_goals" integer,
	"ot_goals" integer,
	"shots" integer,
	"shooting_pct" numeric(7, 5),
	"toi_per_game" numeric(8, 3),
	"faceoff_win_pct" numeric(7, 5),
	"points_per_game" numeric(7, 5),
	CONSTRAINT "skater_season_stats_season_player_id_snapshot_date_pk" PRIMARY KEY("season","player_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "standings_snapshots" (
	"date" date NOT NULL,
	"team_id" integer NOT NULL,
	"season" integer NOT NULL,
	"games_played" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"ot_losses" integer NOT NULL,
	"points" integer NOT NULL,
	"point_pctg" numeric(7, 6),
	"regulation_wins" integer,
	"regulation_plus_ot_wins" integer,
	"goals_for" integer,
	"goals_against" integer,
	"goal_differential" integer,
	"home_wins" integer,
	"home_losses" integer,
	"home_ot_losses" integer,
	"road_wins" integer,
	"road_losses" integer,
	"road_ot_losses" integer,
	"l10_wins" integer,
	"l10_losses" integer,
	"l10_ot_losses" integer,
	"streak_code" text,
	"streak_count" integer,
	"shootout_wins" integer,
	"shootout_losses" integer,
	"division_sequence" integer,
	"conference_sequence" integer,
	"league_sequence" integer,
	"wildcard_sequence" integer,
	CONSTRAINT "standings_snapshots_date_team_id_pk" PRIMARY KEY("date","team_id")
);
--> statement-breakpoint
CREATE TABLE "team_season_stats" (
	"season" integer NOT NULL,
	"team_id" integer NOT NULL,
	"snapshot_date" date NOT NULL,
	"games_played" integer,
	"wins" integer,
	"losses" integer,
	"ot_losses" integer,
	"points" integer,
	"point_pct" numeric(7, 5),
	"goals_for" integer,
	"goals_against" integer,
	"goals_for_per_game" numeric(7, 5),
	"goals_against_per_game" numeric(7, 5),
	"pp_pct" numeric(7, 6),
	"pk_pct" numeric(7, 6),
	"pp_net_pct" numeric(7, 6),
	"pk_net_pct" numeric(7, 6),
	"shots_for_per_game" numeric(7, 5),
	"shots_against_per_game" numeric(7, 5),
	"faceoff_win_pct" numeric(7, 6),
	"regulation_and_ot_wins" integer,
	"wins_in_regulation" integer,
	"wins_in_shootout" integer,
	"shutouts" integer,
	CONSTRAINT "team_season_stats_season_team_id_snapshot_date_pk" PRIMARY KEY("season","team_id","snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" integer PRIMARY KEY NOT NULL,
	"abbrev" text NOT NULL,
	"name" text NOT NULL,
	"common_name" text NOT NULL,
	"place_name" text NOT NULL,
	"conference" text,
	"division" text,
	"logo_url" text,
	"logo_dark_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advanced_team_stats" ADD CONSTRAINT "advanced_team_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_goalie_stats" ADD CONSTRAINT "game_goalie_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_goalie_stats" ADD CONSTRAINT "game_goalie_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_skater_stats" ADD CONSTRAINT "game_skater_stats_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_skater_stats" ADD CONSTRAINT "game_skater_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "odds_snapshots" ADD CONSTRAINT "odds_snapshots_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "standings_snapshots" ADD CONSTRAINT "standings_snapshots_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_season_stats" ADD CONSTRAINT "team_season_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ge_type_idx" ON "game_events" USING btree ("type_desc_key");--> statement-breakpoint
CREATE INDEX "ge_player_idx" ON "game_events" USING btree ("player1_id");--> statement-breakpoint
CREATE INDEX "ggs_player_idx" ON "game_goalie_stats" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "gss_player_idx" ON "game_skater_stats" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "gss_team_idx" ON "game_skater_stats" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "games_date_idx" ON "games" USING btree ("game_date");--> statement-breakpoint
CREATE INDEX "games_home_idx" ON "games" USING btree ("home_team_id");--> statement-breakpoint
CREATE INDEX "games_away_idx" ON "games" USING btree ("away_team_id");--> statement-breakpoint
CREATE INDEX "gss2_date_idx" ON "goalie_season_stats" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "sss_date_idx" ON "skater_season_stats" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "standings_team_idx" ON "standings_snapshots" USING btree ("team_id");