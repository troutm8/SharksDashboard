import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { Headshot } from "@/components/Headshot";
import { fmtToi, num, pct3, signed } from "@/lib/format";
import { getLatestAdvancedSkaters, getLatestGoalieSeason, getLatestSkaterSeason, getTeamPlayers } from "@/lib/queries";
import { TEAM_ABBREV, TEAM_ID } from "@/lib/season";

export const metadata: Metadata = { title: "Roster" };

const POS_NAME: Record<string, string> = { C: "Centers", L: "Left wings", R: "Right wings", D: "Defensemen", G: "Goalies" };
const POS_ORDER = ["C", "L", "R", "D", "G"];

function age(birthDate: string | null): string {
  if (!birthDate) return "—";
  const b = new Date(birthDate);
  const now = new Date();
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a--;
  return String(a);
}
const height = (inches: number | null) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : "—");

export default async function RosterPage({ searchParams }: { searchParams: Promise<{ adv?: string }> }) {
  const sp = await searchParams;
  const adv = sp.adv === "1";
  const [playersAll, skaters, goalies, advanced] = await Promise.all([getTeamPlayers(TEAM_ID), getLatestSkaterSeason(), getLatestGoalieSeason(), getLatestAdvancedSkaters()]);
  const roster = playersAll.filter((p) => p.onRoster);
  if (!roster.length) return <Empty>No roster loaded yet.</Empty>;
  const ids = new Set(roster.map((p) => p.id));
  const onTeam = (abbrevs: string | null) => (abbrevs ?? "").split(",").includes(TEAM_ABBREV);
  const skaterRows = (skaters?.rows ?? []).filter((r) => onTeam(r.teamAbbrevs) || ids.has(r.playerId));
  const goalieRows = (goalies?.rows ?? []).filter((r) => onTeam(r.teamAbbrevs) || ids.has(r.playerId));
  const advAll = new Map((advanced?.rows ?? []).filter((r) => r.situation === "all").map((r) => [r.playerId, r]));
  const adv5 = new Map((advanced?.rows ?? []).filter((r) => r.situation === "5on5").map((r) => [r.playerId, r]));
  const byId = new Map(playersAll.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Roster</h1>
        <p className="text-xs text-muted">
          {roster.length} players. Season stats through {skaters?.date ?? "—"}.{" "}
          {adv ? (
            <Link href="/roster" className="text-teal hover:underline">
              Standard stats
            </Link>
          ) : (
            <Link href="/roster?adv=1" className="text-teal hover:underline">
              Advanced stats (MoneyPuck)
            </Link>
          )}
        </p>
      </div>

      <Card title="Skaters">
        <div className="scroll-x">
          <table className="data w-full text-sm">
            <thead>
              {adv ? (
                <tr>
                  <th>Player</th>
                  <th>Pos</th>
                  <th className="r">GP</th>
                  <th className="r">TOI</th>
                  <th className="r">GS</th>
                  <th className="r">G</th>
                  <th className="r">ixG</th>
                  <th className="r">G-ixG</th>
                  <th className="r">A1</th>
                  <th className="r">A2</th>
                  <th className="r">SOG</th>
                  <th className="r">xGF%</th>
                  <th className="r">Off xGF%</th>
                  <th className="r">CF%</th>
                  <th className="r">Hits</th>
                  <th className="r">Blk</th>
                </tr>
              ) : (
                <tr>
                  <th>Player</th>
                  <th>Pos</th>
                  <th className="r">GP</th>
                  <th className="r">G</th>
                  <th className="r">A</th>
                  <th className="r">P</th>
                  <th className="r">+/-</th>
                  <th className="r">PIM</th>
                  <th className="r">PPG</th>
                  <th className="r">PPP</th>
                  <th className="r">SHG</th>
                  <th className="r">GWG</th>
                  <th className="r">S</th>
                  <th className="r">S%</th>
                  <th className="r">TOI/GP</th>
                  <th className="r">FO%</th>
                </tr>
              )}
            </thead>
            <tbody>
              {skaterRows.map((r) => {
                const p = byId.get(r.playerId);
                const a = advAll.get(r.playerId);
                const a5 = adv5.get(r.playerId);
                return (
                  <tr key={r.playerId}>
                    <td>
                      <Link href={`/players/${r.playerId}`} className="inline-flex items-center gap-2 hover:underline">
                        <Headshot src={p?.headshotUrl} name={r.fullName} size={28} />
                        <span className="w-6 text-right text-xs text-muted tabular">{p?.sweaterNumber ?? ""}</span>
                        {r.fullName}
                        {p && !p.onRoster && <span className="text-[10px] text-muted">(not on roster)</span>}
                      </Link>
                    </td>
                    <td className="text-muted">{r.position}</td>
                    <td className="r tabular">{r.gamesPlayed}</td>
                    {adv ? (
                      <>
                        <td className="r tabular">{fmtToi(a?.iceTime ? Number(a.iceTime) / (a.gamesPlayed || 1) : null)}</td>
                        <td className="r tabular">{num(a?.gameScore, 1)}</td>
                        <td className="r tabular">{a?.iGoals ?? "—"}</td>
                        <td className="r tabular">{num(a?.iXGoals, 1)}</td>
                        <td className={`r tabular ${a && a.iGoals != null && a.iXGoals != null ? (a.iGoals - Number(a.iXGoals) >= 0 ? "text-win" : "text-loss") : ""}`}>{a && a.iGoals != null && a.iXGoals != null ? (a.iGoals - Number(a.iXGoals)).toFixed(1) : "—"}</td>
                        <td className="r tabular">{a?.iPrimaryAssists ?? "—"}</td>
                        <td className="r tabular">{a?.iSecondaryAssists ?? "—"}</td>
                        <td className="r tabular">{a?.iShotsOnGoal ?? "—"}</td>
                        <td className="r tabular">{a5?.onIceXGoalsPct != null ? (Number(a5.onIceXGoalsPct) * 100).toFixed(1) : "—"}</td>
                        <td className="r tabular text-muted">{a5?.offIceXGoalsPct != null ? (Number(a5.offIceXGoalsPct) * 100).toFixed(1) : "—"}</td>
                        <td className="r tabular">{a5?.onIceCorsiPct != null ? (Number(a5.onIceCorsiPct) * 100).toFixed(1) : "—"}</td>
                        <td className="r tabular">{a?.iHits ?? "—"}</td>
                        <td className="r tabular">{a?.shotsBlocked ?? "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="r tabular">{r.goals}</td>
                        <td className="r tabular">{r.assists}</td>
                        <td className="r font-semibold tabular">{r.points}</td>
                        <td className="r tabular">{signed(r.plusMinus)}</td>
                        <td className="r tabular">{r.pim}</td>
                        <td className="r tabular">{r.ppGoals}</td>
                        <td className="r tabular">{r.ppPoints}</td>
                        <td className="r tabular">{r.shGoals}</td>
                        <td className="r tabular">{r.gwGoals}</td>
                        <td className="r tabular">{r.shots}</td>
                        <td className="r tabular">{r.shootingPct != null ? (Number(r.shootingPct) * 100).toFixed(1) : "—"}</td>
                        <td className="r tabular">{fmtToi(r.toiPerGame)}</td>
                        <td className="r tabular">{r.faceoffWinPct != null && Number(r.faceoffWinPct) > 0 ? (Number(r.faceoffWinPct) * 100).toFixed(1) : "—"}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {adv && <p className="mt-2 text-[11px] text-muted">GS game score, ixG individual expected goals (all situations). xGF% and CF% are on-ice shares at 5-on-5; Off xGF% is the team&apos;s share with the player on the bench. From MoneyPuck.</p>}
      </Card>

      <Card title="Goalies">
        <div className="scroll-x">
          <table className="data w-full text-sm">
            <thead>
              <tr>
                <th>Goalie</th>
                <th className="r">GP</th>
                <th className="r">GS</th>
                <th className="r">W</th>
                <th className="r">L</th>
                <th className="r">OTL</th>
                <th className="r">SA</th>
                <th className="r">SV</th>
                <th className="r">GA</th>
                <th className="r">GAA</th>
                <th className="r">SV%</th>
                <th className="r">SO</th>
                <th className="r">TOI</th>
              </tr>
            </thead>
            <tbody>
              {goalieRows.map((r) => {
                const p = byId.get(r.playerId);
                return (
                  <tr key={r.playerId}>
                    <td>
                      <Link href={`/players/${r.playerId}`} className="inline-flex items-center gap-2 hover:underline">
                        <Headshot src={p?.headshotUrl} name={r.fullName} size={28} />
                        <span className="w-6 text-right text-xs text-muted tabular">{p?.sweaterNumber ?? ""}</span>
                        {r.fullName}
                      </Link>
                    </td>
                    <td className="r tabular">{r.gamesPlayed}</td>
                    <td className="r tabular">{r.gamesStarted}</td>
                    <td className="r tabular">{r.wins}</td>
                    <td className="r tabular">{r.losses}</td>
                    <td className="r tabular">{r.otLosses}</td>
                    <td className="r tabular">{r.shotsAgainst}</td>
                    <td className="r tabular">{r.saves}</td>
                    <td className="r tabular">{r.goalsAgainst}</td>
                    <td className="r tabular">{num(r.gaa, 2)}</td>
                    <td className="r font-semibold tabular">{pct3(r.savePct)}</td>
                    <td className="r tabular">{r.shutouts}</td>
                    <td className="r tabular">{fmtToi(r.toiSeconds)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Players">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {POS_ORDER.filter((pos) => roster.some((p) => p.position === pos)).map((pos) => (
            <div key={pos}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{POS_NAME[pos] ?? pos}</h3>
              <ul className="divide-y divide-line text-sm">
                {roster
                  .filter((p) => p.position === pos)
                  .sort((a, b) => (a.sweaterNumber ?? 99) - (b.sweaterNumber ?? 99))
                  .map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-1.5">
                      <Headshot src={p.headshotUrl} name={`${p.firstName} ${p.lastName}`} size={36} />
                      <span className="w-6 text-right text-sm text-muted tabular">{p.sweaterNumber}</span>
                      <span className="min-w-0 flex-1">
                        <Link href={`/players/${p.id}`} className="font-medium hover:underline">
                          {p.firstName} {p.lastName}
                        </Link>
                        <span className="block text-[11px] text-muted">
                          {age(p.birthDate)} · {height(p.heightIn)}, {p.weightLb ?? "—"} lb · {p.shootsCatches === "L" ? "Left" : p.shootsCatches === "R" ? "Right" : "—"}
                          {p.draft ? ` · ${p.draft.year} R${p.draft.round} #${p.draft.overallPick}` : " · undrafted"}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
