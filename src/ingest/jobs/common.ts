import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { players, teams } from "@/db/schema";
import { toiToSeconds } from "@/lib/format";

export const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

/** Drizzle wants numeric columns as strings. */
export function numStr(v: number | null | undefined): string | null {
  return v == null || !Number.isFinite(v) ? null : String(v);
}

export function toiSeconds(toi: string | null | undefined): number | null {
  return toiToSeconds(toi);
}

/** Insert or refresh a team from whatever identity fields a payload carries. */
export async function upsertTeam(
  db: Db,
  t: {
    id: number;
    abbrev: string;
    name?: string | null;
    commonName?: string | null;
    placeName?: string | null;
    conference?: string | null;
    division?: string | null;
    logoUrl?: string | null;
    logoDarkUrl?: string | null;
  },
) {
  const commonName = t.commonName ?? t.abbrev;
  const placeName = t.placeName ?? "";
  const name = t.name ?? `${placeName} ${commonName}`.trim();
  await db
    .insert(teams)
    .values({
      id: t.id,
      abbrev: t.abbrev,
      name,
      commonName,
      placeName,
      conference: t.conference ?? null,
      division: t.division ?? null,
      logoUrl: t.logoUrl ?? null,
      logoDarkUrl: t.logoDarkUrl ?? null,
    })
    .onConflictDoUpdate({
      target: teams.id,
      set: {
        abbrev: t.abbrev,
        ...(t.name ? { name } : {}),
        ...(t.commonName ? { commonName } : {}),
        ...(t.placeName ? { placeName } : {}),
        ...(t.conference ? { conference: t.conference } : {}),
        ...(t.division ? { division: t.division } : {}),
        ...(t.logoUrl ? { logoUrl: t.logoUrl } : {}),
        ...(t.logoDarkUrl ? { logoDarkUrl: t.logoDarkUrl } : {}),
        updatedAt: new Date(),
      },
    });
}

/** Insert or refresh a player's identity without clobbering richer biographical fields. */
export async function upsertPlayerStub(
  db: Db,
  p: { id: number; firstName: string; lastName: string; position?: string | null; sweaterNumber?: number | null; teamId?: number | null; headshotUrl?: string | null },
) {
  await db
    .insert(players)
    .values({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position ?? null,
      sweaterNumber: p.sweaterNumber ?? null,
      teamId: p.teamId ?? null,
      headshotUrl: p.headshotUrl ?? null,
    })
    .onConflictDoUpdate({
      target: players.id,
      set: {
        firstName: p.firstName,
        lastName: p.lastName,
        ...(p.position ? { position: p.position } : {}),
        ...(p.sweaterNumber != null ? { sweaterNumber: p.sweaterNumber } : {}),
        ...(p.teamId != null ? { teamId: p.teamId } : {}),
        ...(p.headshotUrl ? { headshotUrl: p.headshotUrl } : {}),
        updatedAt: new Date(),
      },
    });
}

export async function teamIdByAbbrev(db: Db): Promise<Map<string, number>> {
  const rows = await db.select({ id: teams.id, abbrev: teams.abbrev }).from(teams);
  return new Map(rows.map((r) => [r.abbrev, r.id]));
}

export async function teamExists(db: Db, id: number): Promise<boolean> {
  const [t] = await db.select({ id: teams.id }).from(teams).where(eq(teams.id, id));
  return !!t;
}
