import Link from "next/link";
import type { Metadata } from "next";
import type { StandingsRow, Team } from "@/db/schema";
import { Card, Empty } from "@/components/Card";
import { TeamLogo } from "@/components/TeamLogo";
import { groupStandings, playoffPicture } from "@/lib/derive";
import { fmtYmd, pct3, signed } from "@/lib/format";
import { getLatestStandings, getTeamMap } from "@/lib/queries";
import { TEAM_ID } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata: Metadata = { title: "Standings" };

const VIEWS = [
  ["division", "Division"],
  ["wildcard", "Wild card"],
  ["conference", "Conference"],
  ["league", "League"],
] as const;
type View = (typeof VIEWS)[number][0];

function Table({ rows, teams, startRank = 1, cutAfter, showGB }: { rows: StandingsRow[]; teams: Map<number, Team>; startRank?: number; cutAfter?: number; showGB?: StandingsRow | null }) {
  return (
    <div className="scroll-x">
      <table className="data w-full text-sm">
        <thead>
          <tr>
            <th className="r">#</th>
            <th>Team</th>
            <th className="r">GP</th>
            <th className="r">W</th>
            <th className="r">L</th>
            <th className="r">OTL</th>
            <th className="r">PTS</th>
            <th className="r">P%</th>
            <th className="r">RW</th>
            <th className="r">ROW</th>
            <th className="r">GF</th>
            <th className="r">GA</th>
            <th className="r">DIFF</th>
            <th>Home</th>
            <th>Away</th>
            <th>L10</th>
            <th>Strk</th>
            {showGB && <th className="r">vs line</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const t = teams.get(r.teamId);
            const cls = [r.teamId === TEAM_ID ? "featured" : "", cutAfter != null && i === cutAfter - 1 ? "cutline" : ""].join(" ").trim();
            return (
              <tr key={r.teamId} className={cls}>
                <td className="r text-muted tabular">{startRank + i}</td>
                <td>
                  {t ? (
                    <span className="inline-flex items-center gap-2">
                      <TeamLogo team={teamView(t)} size={22} />
                      <span className="hidden sm:inline">{t.name}</span>
                      <span className="sm:hidden">{t.abbrev}</span>
                    </span>
                  ) : (
                    r.teamId
                  )}
                </td>
                <td className="r tabular">{r.gamesPlayed}</td>
                <td className="r tabular">{r.wins}</td>
                <td className="r tabular">{r.losses}</td>
                <td className="r tabular">{r.otLosses}</td>
                <td className="r font-semibold tabular">{r.points}</td>
                <td className="r tabular">{pct3(r.pointPctg)}</td>
                <td className="r tabular">{r.regulationWins ?? "—"}</td>
                <td className="r tabular">{r.regulationPlusOtWins ?? "—"}</td>
                <td className="r tabular">{r.goalsFor ?? "—"}</td>
                <td className="r tabular">{r.goalsAgainst ?? "—"}</td>
                <td className={`r tabular ${(r.goalDifferential ?? 0) > 0 ? "text-win" : (r.goalDifferential ?? 0) < 0 ? "text-loss" : ""}`}>{signed(r.goalDifferential)}</td>
                <td className="tabular">
                  {r.homeWins}-{r.homeLosses}-{r.homeOtLosses}
                </td>
                <td className="tabular">
                  {r.roadWins}-{r.roadLosses}-{r.roadOtLosses}
                </td>
                <td className="tabular">
                  {r.l10Wins}-{r.l10Losses}-{r.l10OtLosses}
                </td>
                <td className="tabular">
                  {r.streakCode}
                  {r.streakCount}
                </td>
                {showGB && <td className="r tabular text-muted">{signed(r.points - showGB.points)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function StandingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const sp = await searchParams;
  const view: View = (VIEWS.find(([v]) => v === sp.view)?.[0] ?? "division") as View;
  const [standings, teams] = await Promise.all([getLatestStandings(), getTeamMap()]);
  if (!standings) return <Empty>No standings loaded yet.</Empty>;
  const featuredConf = teams.get(TEAM_ID)?.conference ?? "Western";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Standings</h1>
        <p className="text-xs text-muted">Through {fmtYmd(standings.date, { weekday: "long", month: "long", day: "numeric" })}. RW regulation wins, ROW regulation and overtime wins (the tiebreakers).</p>
      </div>
      <nav className="flex gap-1 text-sm">
        {VIEWS.map(([v, label]) => (
          <Link key={v} href={`/standings?view=${v}`} className={`rounded-md px-3 py-1.5 ${v === view ? "bg-teal text-white" : "border border-line hover:bg-soft"}`}>
            {label}
          </Link>
        ))}
      </nav>

      {view === "division" &&
        groupStandings(standings.rows, teams, "division")
          .sort((a, b) => (a.rows[0] && teams.get(a.rows[0].teamId)?.conference === featuredConf ? -1 : 1) - (b.rows[0] && teams.get(b.rows[0].teamId)?.conference === featuredConf ? -1 : 1) || a.name.localeCompare(b.name))
          .map((g) => (
            <Card key={g.name} title={`${g.name} Division`}>
              <Table rows={g.rows} teams={teams} cutAfter={3} />
            </Card>
          ))}

      {view === "conference" &&
        groupStandings(standings.rows, teams, "conference")
          .sort((a, b) => (a.name === featuredConf ? -1 : 1) - (b.name === featuredConf ? -1 : 1))
          .map((g) => (
            <Card key={g.name} title={`${g.name} Conference`}>
              <Table rows={g.rows} teams={teams} cutAfter={8} />
            </Card>
          ))}

      {view === "league" && (
        <Card title="League">
          <Table rows={[...standings.rows].sort((a, b) => (a.leagueSequence ?? 99) - (b.leagueSequence ?? 99))} teams={teams} />
        </Card>
      )}

      {view === "wildcard" &&
        [featuredConf, featuredConf === "Western" ? "Eastern" : "Western"].map((conf) => {
          const p = playoffPicture(standings.rows, teams, conf, TEAM_ID);
          const divisions = groupStandings(p.inside.slice(0, 6), teams, "division");
          return (
            <Card key={conf} title={`${conf} Conference wild card`}>
              <div className="space-y-4">
                {divisions.map((d) => (
                  <div key={d.name}>
                    <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{d.name}</h3>
                    <Table rows={d.rows} teams={teams} />
                  </div>
                ))}
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Wild card</h3>
                  <Table rows={[...p.inside.slice(6), ...p.outside]} teams={teams} cutAfter={2} showGB={p.cutLine} />
                  <p className="mt-2 text-[11px] text-muted">The dashed line is the playoff cut. The last column is points relative to the second wild card.</p>
                </div>
              </div>
            </Card>
          );
        })}
    </div>
  );
}
