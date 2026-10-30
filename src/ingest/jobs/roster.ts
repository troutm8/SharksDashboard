import { eq, notInArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players } from "@/db/schema";
import { TEAM_ABBREV, TEAM_ID } from "@/lib/season";
import * as nhl from "../sources/nhl-web";
import { log } from "./common";

/** The featured club's active roster with full biographical fields. Marks everyone else off the roster. */
export async function ingestRoster(db: Db, abbrev = TEAM_ABBREV, teamId = TEAM_ID): Promise<number> {
  const roster = await nhl.fetchRoster(abbrev, "current");
  const all = [...roster.forwards, ...roster.defensemen, ...roster.goalies];
  for (const p of all) {
    const row = {
      id: p.id,
      firstName: p.firstName.default,
      lastName: p.lastName.default,
      position: p.positionCode,
      sweaterNumber: p.sweaterNumber ?? null,
      teamId,
      headshotUrl: p.headshot ?? null,
      birthDate: p.birthDate ?? null,
      birthCity: p.birthCity?.default ?? null,
      birthCountry: p.birthCountry ?? null,
      heightIn: p.heightInInches ?? null,
      weightLb: p.weightInPounds ?? null,
      shootsCatches: p.shootsCatches ?? null,
      onRoster: true,
      updatedAt: new Date(),
    };
    await db.insert(players).values(row).onConflictDoUpdate({ target: players.id, set: row });
  }
  const ids = all.map((p) => p.id);
  if (ids.length) await db.update(players).set({ onRoster: false }).where(notInArray(players.id, ids));
  log(`roster ${abbrev}: ${all.length} players`);
  return all.length;
}

/** Fill in draft details and bio for players we only know from box scores (Sharks only, it is one call each). */
export async function enrichPlayers(db: Db, limit = 40): Promise<number> {
  const rows = await db.select({ id: players.id }).from(players).where(eq(players.teamId, TEAM_ID));
  let n = 0;
  for (const r of rows.slice(0, limit)) {
    try {
      const p = await nhl.fetchPlayerLanding(r.id);
      await db
        .update(players)
        .set({
          birthDate: p.birthDate ?? null,
          birthCity: p.birthCity?.default ?? null,
          birthCountry: p.birthCountry ?? null,
          heightIn: p.heightInInches ?? null,
          weightLb: p.weightInPounds ?? null,
          shootsCatches: p.shootsCatches ?? null,
          draft: p.draftDetails ?? null,
          headshotUrl: p.headshot ?? null,
          updatedAt: new Date(),
        })
        .where(eq(players.id, r.id));
      n++;
    } catch (err) {
      log(`player ${r.id} landing failed:`, (err as Error).message);
    }
  }
  log(`players enriched: ${n}`);
  return n;
}
