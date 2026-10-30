import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { TeamLogo } from "@/components/TeamLogo";
import { POWER_WEIGHTS, powerRankings, type PowerInput } from "@/lib/derive";
import { fmtYmd, pct1, signed } from "@/lib/format";
import { getLatestAdvancedTeams, getLatestOdds, getLatestStandings, getTeamMap } from "@/lib/queries";
import { TEAM_ID } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata: Metadata = { title: "Rankings" };

export default async function RankingsPage() {
  const [standings, advanced, odds, teams] = await Promise.all([getLatestStandings(), getLatestAdvancedTeams(), getLatestOdds(), getTeamMap()]);
  if (!standings) return <Empty>No standings loaded yet.</Empty>;
  const xg = new Map((advanced?.rows ?? []).filter((r) => r.situation === "5on5").map((r) => [r.teamId, r.xGoalsPct == null ? null : Number(r.xGoalsPct)]));
  const inputs: PowerInput[] = standings.rows.map((r) => ({
    teamId: r.teamId,
    gamesPlayed: r.gamesPlayed,
    pointPct: r.pointPctg == null ? (r.gamesPlayed ? r.points / (r.gamesPlayed * 2) : 0) : Number(r.pointPctg),
    goalDifferential: r.goalDifferential ?? 0,
    xgPct: xg.get(r.teamId) ?? null,
    l10Points: (r.l10Wins ?? 0) * 2 + (r.l10OtLosses ?? 0),
    l10Games: (r.l10Wins ?? 0) + (r.l10Losses ?? 0) + (r.l10OtLosses ?? 0),
  }));
  const ranked = powerRankings(inputs);
  const standingsBy = new Map(standings.rows.map((r) => [r.teamId, r]));
  const oddsBy = new Map((odds?.rows ?? []).map((r) => [r.teamId, r]));
  const leagueRank = new Map(standings.rows.map((r) => [r.teamId, r.leagueSequence ?? 0]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Rankings</h1>
        <p className="text-xs text-muted">
          Standings through {fmtYmd(standings.date)}; xG through {advanced?.date ?? "—"}; odds {odds ? fmtYmd(odds.date) : "—"}.
        </p>
      </div>

      <Card title="Power rankings">
        <div className="scroll-x">
          <table className="data w-full text-sm">
            <thead>
              <tr>
                <th className="r">#</th>
                <th>Team</th>
                <th className="r">Score</th>
                <th className="r">Pts%</th>
                <th className="r">Goal diff</th>
                <th className="r">5v5 xG</th>
                <th className="r">Last 10</th>
                <th className="r">Record</th>
                <th className="r">Standings</th>
                <th className="r">Playoffs</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const s = standingsBy.get(r.teamId)!;
                const t = teams.get(r.teamId);
                const o = oddsBy.get(r.teamId);
                const move = (leagueRank.get(r.teamId) ?? r.rank) - r.rank;
                return (
                  <tr key={r.teamId} className={r.teamId === TEAM_ID ? "featured" : ""}>
                    <td className="r tabular">
                      {r.rank}
                      {move !== 0 && <span className={`ml-1 text-[10px] ${move > 0 ? "text-win" : "text-loss"}`}>{move > 0 ? `▲${move}` : `▼${-move}`}</span>}
                    </td>
                    <td>
                      {t && (
                        <span className="inline-flex items-center gap-2">
                          <TeamLogo team={teamView(t)} size={22} />
                          <span className="hidden sm:inline">{t.name}</span>
                          <span className="sm:hidden">{t.abbrev}</span>
                        </span>
                      )}
                    </td>
                    <td className="r font-semibold tabular">{r.score.toFixed(1)}</td>
                    <td className="r text-muted tabular">{r.components.points.toFixed(1)}</td>
                    <td className="r text-muted tabular">{r.components.goalDiff.toFixed(1)}</td>
                    <td className="r text-muted tabular">{r.components.xg.toFixed(1)}</td>
                    <td className="r text-muted tabular">{r.components.form.toFixed(1)}</td>
                    <td className="r tabular">
                      {s.wins}-{s.losses}-{s.otLosses}
                    </td>
                    <td className="r tabular">{s.leagueSequence}</td>
                    <td className="r tabular">{pct1(o?.madePlayoffs)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Score out of 100: points percentage ({POWER_WEIGHTS.points}), goal differential per game scaled from -1.5 to +1.5 ({POWER_WEIGHTS.goalDiff}), 5-on-5 expected-goals share scaled from 40% to 60% ({POWER_WEIGHTS.xg}, MoneyPuck), points over the last ten games ({POWER_WEIGHTS.form}). The arrow compares with the team&apos;s place in the league standings. Computed here; nothing official about it.
        </p>
      </Card>

      <Card title="Playoff odds" action={<span className="text-[11px] text-muted">MoneyPuck simulations</span>}>
        {odds ? (
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th className="r">#</th>
                  <th>Team</th>
                  <th className="r">Record</th>
                  <th className="r">Proj. pts</th>
                  <th className="r">Playoffs</th>
                  <th className="r">Division</th>
                  <th className="r">Round 2</th>
                  <th className="r">Conf. final</th>
                  <th className="r">Cup final</th>
                  <th className="r">Cup</th>
                  <th className="r">1st pick</th>
                </tr>
              </thead>
              <tbody>
                {odds.rows.map((o, i) => {
                  const t = teams.get(o.teamId);
                  const s = standingsBy.get(o.teamId);
                  return (
                    <tr key={o.teamId} className={o.teamId === TEAM_ID ? "featured" : ""}>
                      <td className="r text-muted tabular">{i + 1}</td>
                      <td>
                        {t && (
                          <span className="inline-flex items-center gap-2">
                            <TeamLogo team={teamView(t)} size={22} />
                            <span className="hidden sm:inline">{t.name}</span>
                            <span className="sm:hidden">{t.abbrev}</span>
                          </span>
                        )}
                      </td>
                      <td className="r tabular">{s ? `${s.wins}-${s.losses}-${s.otLosses}` : "—"}</td>
                      <td className="r tabular">
                        {o.projectedPoints ? Number(o.projectedPoints).toFixed(0) : "—"}
                        {s && o.projectedPoints && <span className="ml-1 text-[10px] text-muted">({signed(Math.round(Number(o.projectedPoints)) - s.points)})</span>}
                      </td>
                      <td className="r font-semibold tabular">{pct1(o.madePlayoffs)}</td>
                      <td className="r tabular">{pct1(o.wonDivision)}</td>
                      <td className="r tabular">{pct1(o.round2)}</td>
                      <td className="r tabular">{pct1(o.round3)}</td>
                      <td className="r tabular">{pct1(o.round4)}</td>
                      <td className="r tabular">{pct1(o.wonCup)}</td>
                      <td className="r tabular">{pct1(o.firstOverall)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No odds loaded.</Empty>
        )}
      </Card>
    </div>
  );
}
