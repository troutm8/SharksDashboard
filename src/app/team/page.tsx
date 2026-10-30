import Link from "next/link";
import type { Metadata } from "next";
import { Card, Empty } from "@/components/Card";
import { ShotMap, ShotMapLegend } from "@/components/ShotMap";
import { Sparkline } from "@/components/Sparkline";
import { TeamLogo } from "@/components/TeamLogo";
import { computeRecord, finishedGames, rankOf, seasonSeries, splitPoints, splitText, type Split } from "@/lib/derive";
import { fmtYmd, ordinal, signed } from "@/lib/format";
import { getFeaturedTeam, getLatestAdvancedTeams, getLatestTeamSeason, getTeamGames, getTeamMap, getTeamShotEvents } from "@/lib/queries";
import { TEAM_ID } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata: Metadata = { title: "Team" };

type Stat = { label: string; value: number | null; fmt: (v: number) => string; higherIsBetter: boolean; all: (number | null)[] };

function StatRows({ stats }: { stats: Stat[] }) {
  return (
    <table className="data w-full text-sm">
      <thead>
        <tr>
          <th>Stat</th>
          <th className="r">Sharks</th>
          <th className="r">NHL rank</th>
          <th className="r">League avg</th>
        </tr>
      </thead>
      <tbody>
        {stats.map((s) => {
          const rank = rankOf(s.value, s.all, s.higherIsBetter);
          const vals = s.all.filter((v): v is number => v != null);
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          return (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td className="r font-semibold tabular">{s.value == null ? "—" : s.fmt(s.value)}</td>
              <td className={`r tabular ${rank == null ? "" : rank <= 8 ? "text-win" : rank >= 25 ? "text-loss" : ""}`}>{rank ? ordinal(rank) : "—"}</td>
              <td className="r text-muted tabular">{avg == null ? "—" : s.fmt(avg)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default async function TeamPage() {
  const [featured, games, teamMap, teamSeason, advanced, shots] = await Promise.all([getFeaturedTeam(), getTeamGames(TEAM_ID), getTeamMap(), getLatestTeamSeason(), getLatestAdvancedTeams(), getTeamShotEvents(TEAM_ID)]);
  if (!featured) return <Empty>No data yet.</Empty>;
  const regular = games.filter((g) => g.gameType === 2);
  const record = computeRecord(TEAM_ID, regular, teamMap);
  const finals = finishedGames(regular);

  const ts = teamSeason?.rows ?? [];
  const mine = ts.find((r) => r.teamId === TEAM_ID);
  const n = (v: string | number | null | undefined) => (v == null ? null : Number(v));
  const col = (f: (r: (typeof ts)[number]) => string | number | null | undefined) => ts.map((r) => n(f(r)));
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const standard: Stat[] = mine
    ? [
        { label: "Goals for / game", value: n(mine.goalsForPerGame), fmt: (v) => v.toFixed(2), higherIsBetter: true, all: col((r) => r.goalsForPerGame) },
        { label: "Goals against / game", value: n(mine.goalsAgainstPerGame), fmt: (v) => v.toFixed(2), higherIsBetter: false, all: col((r) => r.goalsAgainstPerGame) },
        { label: "Power play", value: n(mine.ppPct), fmt: pct, higherIsBetter: true, all: col((r) => r.ppPct) },
        { label: "Penalty kill", value: n(mine.pkPct), fmt: pct, higherIsBetter: true, all: col((r) => r.pkPct) },
        { label: "Shots for / game", value: n(mine.shotsForPerGame), fmt: (v) => v.toFixed(1), higherIsBetter: true, all: col((r) => r.shotsForPerGame) },
        { label: "Shots against / game", value: n(mine.shotsAgainstPerGame), fmt: (v) => v.toFixed(1), higherIsBetter: false, all: col((r) => r.shotsAgainstPerGame) },
        { label: "Faceoff win %", value: n(mine.faceoffWinPct), fmt: pct, higherIsBetter: true, all: col((r) => r.faceoffWinPct) },
        { label: "Points %", value: n(mine.pointPct), fmt: (v) => v.toFixed(3).replace(/^0/, ""), higherIsBetter: true, all: col((r) => r.pointPct) },
      ]
    : [];

  const adv = advanced?.rows ?? [];
  const sit = (s: string) => adv.filter((r) => r.situation === s);
  const advRows = (s: string): Stat[] => {
    const rows = sit(s);
    const me = rows.find((r) => r.teamId === TEAM_ID);
    if (!me) return [];
    const c = (f: (r: (typeof rows)[number]) => string | number | null | undefined) => rows.map((r) => n(f(r)));
    const perGame = (f: (r: (typeof rows)[number]) => string | number | null | undefined) => rows.map((r) => (r.gamesPlayed ? n(f(r))! / r.gamesPlayed : null));
    return [
      { label: "Expected goals share (xGF%)", value: n(me.xGoalsPct), fmt: pct, higherIsBetter: true, all: c((r) => r.xGoalsPct) },
      { label: "Shot attempt share (CF%)", value: n(me.corsiPct), fmt: pct, higherIsBetter: true, all: c((r) => r.corsiPct) },
      { label: "Unblocked attempt share (FF%)", value: n(me.fenwickPct), fmt: pct, higherIsBetter: true, all: c((r) => r.fenwickPct) },
      { label: "xG for / game", value: me.gamesPlayed ? n(me.xGoalsFor)! / me.gamesPlayed : null, fmt: (v) => v.toFixed(2), higherIsBetter: true, all: perGame((r) => r.xGoalsFor) },
      { label: "xG against / game", value: me.gamesPlayed ? n(me.xGoalsAgainst)! / me.gamesPlayed : null, fmt: (v) => v.toFixed(2), higherIsBetter: false, all: perGame((r) => r.xGoalsAgainst) },
      { label: "Goals above expected", value: me.goalsFor != null && me.xGoalsFor != null ? me.goalsFor - Number(me.xGoalsFor) : null, fmt: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)), higherIsBetter: true, all: rows.map((r) => (r.goalsFor != null && r.xGoalsFor != null ? r.goalsFor - Number(r.xGoalsFor) : null)) },
      { label: "Goals against above expected", value: me.goalsAgainst != null && me.xGoalsAgainst != null ? me.goalsAgainst - Number(me.xGoalsAgainst) : null, fmt: (v) => (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)), higherIsBetter: false, all: rows.map((r) => (r.goalsAgainst != null && r.xGoalsAgainst != null ? r.goalsAgainst - Number(r.xGoalsAgainst) : null)) },
      { label: "High-danger xG share", value: me.highDangerXGoalsFor != null && me.highDangerXGoalsAgainst != null ? Number(me.highDangerXGoalsFor) / (Number(me.highDangerXGoalsFor) + Number(me.highDangerXGoalsAgainst)) : null, fmt: pct, higherIsBetter: true, all: rows.map((r) => (r.highDangerXGoalsFor != null && r.highDangerXGoalsAgainst != null ? Number(r.highDangerXGoalsFor) / (Number(r.highDangerXGoalsFor) + Number(r.highDangerXGoalsAgainst)) : null)) },
    ];
  };

  // Goal differential by game, cumulative.
  const diffs = finals.map((g) => (g.homeTeamId === TEAM_ID ? g.homeScore! - g.awayScore! : g.awayScore! - g.homeScore!));
  const cumDiff = diffs.reduce<number[]>((acc, d) => [...acc, (acc[acc.length - 1] ?? 0) + d], []);
  const cumPts = record.results.reduce<number[]>((acc, o) => [...acc, (acc[acc.length - 1] ?? 0) + (o === "W" ? 2 : o === "OTL" ? 1 : 0)], []);

  const division = [...teamMap.values()].filter((t) => t.division === featured.division && t.id !== TEAM_ID).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4">
        <TeamLogo team={teamView(featured)} size={64} />
        <div>
          <h1 className="text-2xl font-bold">{featured.name}</h1>
          <p className="text-sm text-muted">
            {record.w}-{record.l}-{record.otl}, {record.points} points · {record.gf} GF, {record.ga} GA ({signed(record.diff)}) · {record.regulationWins} regulation wins
          </p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Season stats" action={<span className="text-[11px] text-muted">NHL, through {teamSeason?.date ?? "—"}</span>}>
          {standard.length ? <StatRows stats={standard} /> : <Empty>No team stats loaded.</Empty>}
        </Card>
        <Card title="5-on-5 underlying numbers" action={<span className="text-[11px] text-muted">MoneyPuck, through {advanced?.date ?? "—"}</span>}>
          {advRows("5on5").length ? <StatRows stats={advRows("5on5")} /> : <Empty>No advanced stats loaded.</Empty>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Splits">
          <table className="data w-full text-sm">
            <tbody>
              {(
                [
                  ["Home", record.home],
                  ["Road", record.road],
                  ["One-goal games", record.oneGoal],
                  ["Overtime and shootouts", record.overtime],
                  [`vs ${featured.division}`, record.vsDivision],
                  [`vs ${featured.conference}`, record.vsConference],
                  ...record.byMonth.map((m) => [fmtYmd(`${m.month}-01`, { month: "long" }), m.split] as [string, Split]),
                ] as [string, Split][]
              ).map(([label, s]) => (
                <tr key={String(label)}>
                  <td>{label}</td>
                  <td className="r tabular">{splitText(s)}</td>
                  <td className="r text-muted tabular">{splitPoints(s)} pts</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Trends">
          {cumPts.length > 2 ? (
            <div className="space-y-4">
              <div className="text-teal">
                <Sparkline values={cumPts} width={300} height={56} label="Points, cumulative" />
                <p className="text-[11px] text-muted">Points, cumulative, by game</p>
              </div>
              <div className="text-teal">
                <Sparkline values={cumDiff} width={300} height={56} baseline={0} label="Goal differential, cumulative" />
                <p className="text-[11px] text-muted">Goal differential, cumulative, by game</p>
              </div>
              <div className="text-teal">
                <Sparkline values={diffs} width={300} height={56} baseline={0} label="Goal margin by game" />
                <p className="text-[11px] text-muted">Margin of each game</p>
              </div>
            </div>
          ) : (
            <Empty>Not enough games yet.</Empty>
          )}
        </Card>
        <Card title={`${featured.division} Division series`}>
          <ul className="divide-y divide-line text-sm">
            {division.map((t) => {
              const s = seasonSeries(TEAM_ID, t.id, regular);
              const remaining = regular.filter((g) => (g.homeTeamId === t.id || g.awayTeamId === t.id) && g.gameState !== "OFF" && g.gameState !== "FINAL").length;
              return (
                <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <TeamLogo team={teamView(t)} size={22} /> {t.commonName}
                  </span>
                  <span className="text-right tabular">
                    {s.games.length ? splitText(s.split) : <span className="text-muted">—</span>}
                    <span className="ml-2 text-xs text-muted">{remaining} left</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {shots.length > 0 && (
        <Card title="Shot map, this season" action={<Link href="/schedule" className="text-xs text-teal hover:underline">By game →</Link>}>
          <ShotMap shots={shots.map((s) => s.e)} featuredId={TEAM_ID} width={900} />
          <ShotMapLegend featuredName="Sharks" opponentName="Opponents" />
          <p className="mt-1 text-[11px] text-muted">
            {shots.filter((s) => s.e.teamId === TEAM_ID && s.e.typeDescKey !== "blocked-shot").length} unblocked Sharks attempts and {shots.filter((s) => s.e.teamId !== TEAM_ID && s.e.typeDescKey !== "blocked-shot").length} against, from {new Set(shots.map((s) => s.e.gameId)).size} games with play-by-play.
          </p>
        </Card>
      )}

      {advRows("all").length > 0 && (
        <Card title="All situations" action={<span className="text-[11px] text-muted">MoneyPuck</span>}>
          <StatRows stats={advRows("all")} />
          <p className="mt-2 text-[11px] text-muted">
            xG is expected goals: the number of goals an average team would score from the same shots. Share stats are Sharks divided by Sharks plus opponents. Ranks are among all 32 teams.
          </p>
        </Card>
      )}
    </div>
  );
}
