import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, Empty } from "@/components/Card";
import { Headshot } from "@/components/Headshot";
import { ShotMap, ShotMapLegend } from "@/components/ShotMap";
import { Sparkline } from "@/components/Sparkline";
import { TeamLogo } from "@/components/TeamLogo";
import { finalSuffix, fmtToi, fmtYmd, num, pct3, signed } from "@/lib/format";
import { getLatestAdvancedSkaters, getLatestGoalieSeason, getLatestSkaterSeason, getPlayer, getPlayerGameLog, getPlayerShotEvents, getTeam } from "@/lib/queries";
import { TEAM_ID } from "@/lib/season";
import { teamView } from "@/lib/views";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = /^\d+$/.test(id) ? await getPlayer(Number(id)) : null;
  return { title: p ? `${p.firstName} ${p.lastName}` : "Player" };
}

const height = (inches: number | null) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : null);

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const playerId = Number(id);
  const player = await getPlayer(playerId);
  if (!player) notFound();
  const [team, log, skaters, goalies, advanced, shots] = await Promise.all([
    player.teamId ? getTeam(player.teamId) : null,
    getPlayerGameLog(playerId),
    getLatestSkaterSeason(),
    getLatestGoalieSeason(),
    getLatestAdvancedSkaters(),
    getPlayerShotEvents(playerId),
  ]);
  const isGoalie = player.position === "G";
  const season = isGoalie ? goalies?.rows.find((r) => r.playerId === playerId) : skaters?.rows.find((r) => r.playerId === playerId);
  const goalieSeason = isGoalie ? goalies?.rows.find((r) => r.playerId === playerId) : null;
  const skaterSeason = !isGoalie ? skaters?.rows.find((r) => r.playerId === playerId) : null;
  const advAll = advanced?.rows.find((r) => r.playerId === playerId && r.situation === "all");
  const adv5 = advanced?.rows.find((r) => r.playerId === playerId && r.situation === "5on5");
  const name = `${player.firstName} ${player.lastName}`;
  const regularLog = log.skater.filter((r) => r.game.gameType === 2);
  const regularGoalieLog = log.goalie.filter((r) => r.game.gameType === 2);

  // Rolling 10-game points, for the chart.
  const pts = regularLog.map((r) => r.points ?? 0);
  const rolling = pts.map((_, i) => pts.slice(Math.max(0, i - 9), i + 1).reduce((a, b) => a + b, 0));
  const cumulative = pts.reduce<number[]>((acc, p) => [...acc, (acc[acc.length - 1] ?? 0) + p], []);

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center gap-4">
        <Headshot src={player.headshotUrl} name={name} size={96} />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">
            {player.sweaterNumber != null && <span className="mr-2 text-muted">#{player.sweaterNumber}</span>}
            {name}
          </h1>
          <p className="text-sm text-muted">
            {player.position === "G" ? "Goalie" : player.position === "D" ? "Defense" : player.position === "C" ? "Center" : player.position === "L" ? "Left wing" : player.position === "R" ? "Right wing" : player.position}
            {team && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1 align-middle">
                  <TeamLogo team={teamView(team)} size={18} /> {team.name}
                </span>
              </>
            )}
            {player.shootsCatches && ` · ${isGoalie ? "Catches" : "Shoots"} ${player.shootsCatches}`}
          </p>
          <p className="text-xs text-muted">
            {[height(player.heightIn), player.weightLb ? `${player.weightLb} lb` : null, player.birthDate ? `born ${fmtYmd(player.birthDate, { month: "long", day: "numeric", year: "numeric" })}` : null, player.birthCity ? `${player.birthCity}${player.birthCountry ? `, ${player.birthCountry}` : ""}` : null]
              .filter(Boolean)
              .join(" · ")}
            {player.draft ? ` · Drafted ${player.draft.year}, round ${player.draft.round}, #${player.draft.overallPick} overall by ${player.draft.teamAbbrev}` : ""}
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="This season" className="md:col-span-2">
          {skaterSeason ? (
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-6">
              {[
                ["GP", skaterSeason.gamesPlayed],
                ["G", skaterSeason.goals],
                ["A", skaterSeason.assists],
                ["P", skaterSeason.points],
                ["+/-", signed(skaterSeason.plusMinus)],
                ["PIM", skaterSeason.pim],
                ["PPG", skaterSeason.ppGoals],
                ["PPP", skaterSeason.ppPoints],
                ["GWG", skaterSeason.gwGoals],
                ["Shots", skaterSeason.shots],
                ["S%", skaterSeason.shootingPct != null ? `${(Number(skaterSeason.shootingPct) * 100).toFixed(1)}` : "—"],
                ["TOI/GP", fmtToi(skaterSeason.toiPerGame)],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="text-lg font-semibold tabular">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          ) : goalieSeason ? (
            <dl className="grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-6">
              {[
                ["GP", goalieSeason.gamesPlayed],
                ["GS", goalieSeason.gamesStarted],
                ["W-L-OTL", `${goalieSeason.wins}-${goalieSeason.losses}-${goalieSeason.otLosses}`],
                ["GAA", num(goalieSeason.gaa, 2)],
                ["SV%", pct3(goalieSeason.savePct)],
                ["SO", goalieSeason.shutouts],
                ["SA", goalieSeason.shotsAgainst],
                ["SV", goalieSeason.saves],
                ["GA", goalieSeason.goalsAgainst],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="text-lg font-semibold tabular">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Empty>No season line yet.</Empty>
          )}
          {season && <p className="mt-2 text-[11px] text-muted">NHL season totals through {(isGoalie ? goalies : skaters)?.date}.</p>}
          {rolling.length > 2 && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="text-teal">
                <Sparkline values={cumulative} width={280} height={48} label="Cumulative points" />
                <p className="text-[11px] text-muted">Points, cumulative, by game</p>
              </div>
              <div className="text-teal">
                <Sparkline values={rolling} width={280} height={48} min={0} label="Rolling 10-game points" />
                <p className="text-[11px] text-muted">Points over the last 10 games</p>
              </div>
            </div>
          )}
        </Card>

        <Card title="Advanced" action={<span className="text-[11px] text-muted">MoneyPuck</span>}>
          {advAll ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Game score</dt>
              <dd className="tabular">{num(advAll.gameScore, 1)}</dd>
              <dt className="text-muted">Individual xG</dt>
              <dd className="tabular">
                {num(advAll.iXGoals, 1)} <span className="text-xs text-muted">({advAll.iGoals ?? 0} G)</span>
              </dd>
              <dt className="text-muted">High-danger xG</dt>
              <dd className="tabular">{num(advAll.iHighDangerXGoals, 1)}</dd>
              <dt className="text-muted">A1 / A2</dt>
              <dd className="tabular">
                {advAll.iPrimaryAssists ?? 0} / {advAll.iSecondaryAssists ?? 0}
              </dd>
              <dt className="text-muted">On-ice xGF% (5v5)</dt>
              <dd className="tabular">{adv5?.onIceXGoalsPct != null ? `${(Number(adv5.onIceXGoalsPct) * 100).toFixed(1)}%` : "—"}</dd>
              <dt className="text-muted">Off-ice xGF% (5v5)</dt>
              <dd className="tabular">{adv5?.offIceXGoalsPct != null ? `${(Number(adv5.offIceXGoalsPct) * 100).toFixed(1)}%` : "—"}</dd>
              <dt className="text-muted">On-ice CF% (5v5)</dt>
              <dd className="tabular">{adv5?.onIceCorsiPct != null ? `${(Number(adv5.onIceCorsiPct) * 100).toFixed(1)}%` : "—"}</dd>
              <dt className="text-muted">Hits / Blocks</dt>
              <dd className="tabular">
                {advAll.iHits ?? 0} / {advAll.shotsBlocked ?? 0}
              </dd>
              <dt className="text-muted">Takeaways / Giveaways</dt>
              <dd className="tabular">
                {advAll.iTakeaways ?? 0} / {advAll.iGiveaways ?? 0}
              </dd>
            </dl>
          ) : (
            <Empty>{isGoalie ? "Goalie models are not loaded." : "Only Sharks skaters have advanced stats loaded."}</Empty>
          )}
        </Card>
      </div>

      {!isGoalie && shots.length > 0 && (
        <Card title="Shot map, this season">
          <ShotMap shots={shots.map((s) => s.e)} featuredId={player.teamId ?? TEAM_ID} width={720} />
          <ShotMapLegend featuredName={name} />
          <p className="mt-1 text-[11px] text-muted">
            {shots.filter((s) => s.e.typeDescKey === "goal").length} goals, {shots.filter((s) => s.e.typeDescKey === "shot-on-goal").length} other shots on goal, {shots.filter((s) => s.e.typeDescKey === "missed-shot").length} missed, {shots.filter((s) => s.e.typeDescKey === "blocked-shot").length} blocked, from the games we hold play-by-play for.
          </p>
        </Card>
      )}

      <Card title="Game log">
        {regularLog.length ? (
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th className="r">G</th>
                  <th className="r">A</th>
                  <th className="r">P</th>
                  <th className="r">+/-</th>
                  <th className="r">PIM</th>
                  <th className="r">SOG</th>
                  <th className="r">Hits</th>
                  <th className="r">Blk</th>
                  <th className="r">TOI</th>
                </tr>
              </thead>
              <tbody>
                {[...regularLog].reverse().map((r) => {
                  const g = r.game;
                  const isHome = g.homeTeamId === r.teamId;
                  const opp = isHome ? g.away : g.home;
                  const mine = isHome ? g.homeScore : g.awayScore;
                  const theirs = isHome ? g.awayScore : g.homeScore;
                  return (
                    <tr key={g.id}>
                      <td className="text-muted">
                        <Link href={`/games/${g.id}`} className="hover:underline">
                          {fmtYmd(g.gameDate)}
                        </Link>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <TeamLogo team={teamView(opp)} size={20} />
                          <span className="text-muted">{isHome ? "vs" : "@"}</span> {opp.abbrev}
                        </span>
                      </td>
                      <td className="tabular">
                        <span className={(mine ?? 0) > (theirs ?? 0) ? "text-win" : "text-loss"}>{(mine ?? 0) > (theirs ?? 0) ? "W" : "L"}</span> {mine}-{theirs}
                        {finalSuffix(g.lastPeriodType)}
                      </td>
                      <td className="r tabular">{r.goals}</td>
                      <td className="r tabular">{r.assists}</td>
                      <td className="r font-semibold tabular">{r.points}</td>
                      <td className="r tabular">{signed(r.plusMinus)}</td>
                      <td className="r tabular">{r.pim}</td>
                      <td className="r tabular">{r.sog}</td>
                      <td className="r tabular">{r.hits}</td>
                      <td className="r tabular">{r.blockedShots}</td>
                      <td className="r tabular">{fmtToi(r.toiSeconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : regularGoalieLog.length ? (
          <div className="scroll-x">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th>Result</th>
                  <th className="r">Dec</th>
                  <th className="r">SA</th>
                  <th className="r">SV</th>
                  <th className="r">GA</th>
                  <th className="r">SV%</th>
                  <th className="r">TOI</th>
                </tr>
              </thead>
              <tbody>
                {[...regularGoalieLog].reverse().map((r) => {
                  const g = r.game;
                  const isHome = g.homeTeamId === r.teamId;
                  const opp = isHome ? g.away : g.home;
                  const mine = isHome ? g.homeScore : g.awayScore;
                  const theirs = isHome ? g.awayScore : g.homeScore;
                  return (
                    <tr key={g.id}>
                      <td className="text-muted">
                        <Link href={`/games/${g.id}`} className="hover:underline">
                          {fmtYmd(g.gameDate)}
                        </Link>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-2">
                          <TeamLogo team={teamView(opp)} size={20} />
                          <span className="text-muted">{isHome ? "vs" : "@"}</span> {opp.abbrev}
                        </span>
                      </td>
                      <td className="tabular">
                        {mine}-{theirs}
                        {finalSuffix(g.lastPeriodType)}
                      </td>
                      <td className="r tabular">{r.decision ?? ""}</td>
                      <td className="r tabular">{r.shotsAgainst}</td>
                      <td className="r tabular">{r.saves}</td>
                      <td className="r tabular">{r.goalsAgainst}</td>
                      <td className="r tabular">{pct3(r.savePctg)}</td>
                      <td className="r tabular">{fmtToi(r.toiSeconds)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No games in the box scores we hold. Only Sharks games are loaded.</Empty>
        )}
      </Card>
    </div>
  );
}
