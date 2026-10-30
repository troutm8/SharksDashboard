import type { TeamView } from "@/lib/views";

/** NHL logos are SVGs with a light and a dark variant; show the right one for the color scheme. */
export function TeamLogo({ team, size = 28, className = "" }: { team: Pick<TeamView, "abbrev" | "logo" | "logoDark">; size?: number; className?: string }) {
  if (team.logo) {
    return (
      <picture className={`inline-flex shrink-0 ${className}`}>
        {team.logoDark && <source srcSet={team.logoDark} media="(prefers-color-scheme: dark)" />}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={team.logo} alt="" width={size} height={size} className="object-contain" style={{ width: size, height: size }} loading="lazy" />
      </picture>
    );
  }
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-soft text-[10px] font-semibold text-muted ${className}`} style={{ width: size, height: size }} aria-hidden>
      {team.abbrev.slice(0, 3)}
    </span>
  );
}
