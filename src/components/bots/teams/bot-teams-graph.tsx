"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3";
import { ArrowRight, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotAvatar, BOT_ICON_COMPONENTS } from "@/components/bots/bot-avatar";
import type { BotColor } from "@/lib/bots/schema";
import { TeamMarkdown } from "@/components/bots/teams/team-markdown";
import {
  TEAM_NODE_RADIUS,
  cellCenter,
  clampToCell,
  edgeGeometry,
  findHub,
  initialPositions,
  ringTarget,
  teamGridLayout,
  truncateLabel,
  type GraphCell,
  type GraphPoint,
  type TeamGraphTeam,
} from "@/lib/bots/team-graph";
import { getBotTeamUrl, getBotUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

type Member = TeamGraphTeam["members"][number];

interface SimNode extends SimulationNodeDatum {
  key: string;
  teamIndex: number;
  member: Member;
  /** Sits on the ring around its team's hub */
  onRing: boolean;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  teamIndex: number;
  linkIndex: number;
  curved: boolean;
}

/** Full class strings so Tailwind keeps them; drawn over a solid circle so edges never show through */
const NODE_STYLES: Record<BotColor, string> = {
  slate: "fill-slate-500/15 stroke-slate-500/60 text-slate-700 dark:text-slate-300",
  red: "fill-red-500/15 stroke-red-500/60 text-red-700 dark:text-red-300",
  orange: "fill-orange-500/15 stroke-orange-500/60 text-orange-700 dark:text-orange-300",
  amber: "fill-amber-500/15 stroke-amber-500/60 text-amber-700 dark:text-amber-300",
  lime: "fill-lime-500/15 stroke-lime-500/60 text-lime-700 dark:text-lime-300",
  emerald: "fill-emerald-500/15 stroke-emerald-500/60 text-emerald-700 dark:text-emerald-300",
  teal: "fill-teal-500/15 stroke-teal-500/60 text-teal-700 dark:text-teal-300",
  sky: "fill-sky-500/15 stroke-sky-500/60 text-sky-700 dark:text-sky-300",
  blue: "fill-blue-500/15 stroke-blue-500/60 text-blue-700 dark:text-blue-300",
  indigo: "fill-indigo-500/15 stroke-indigo-500/60 text-indigo-700 dark:text-indigo-300",
  violet: "fill-violet-500/15 stroke-violet-500/60 text-violet-700 dark:text-violet-300",
  pink: "fill-pink-500/15 stroke-pink-500/60 text-pink-700 dark:text-pink-300",
};
const DEFAULT_NODE_STYLE = "fill-muted stroke-border text-muted-foreground";

const nodeKey = (teamIndex: number, botId: string) => `${teamIndex}:${botId}`;

/** Pulls each hub team's other members onto the ring around the hub, so the team reads as a star */
function ringForce(cells: GraphCell[], strength: number) {
  let nodes: SimNode[] = [];
  const force = (alpha: number) => {
    for (const node of nodes) {
      if (!node.onRing) continue;
      const target = ringTarget({ x: node.x ?? 0, y: node.y ?? 0 }, cells[node.teamIndex]);
      node.vx = (node.vx ?? 0) + (target.x - (node.x ?? 0)) * strength * alpha;
      node.vy = (node.vy ?? 0) + (target.y - (node.y ?? 0)) * strength * alpha;
    }
  };
  force.initialize = (all: SimNode[]) => {
    nodes = all;
  };
  return force;
}

/**
 * Runs d3-force inside each team's cell and re-renders on every tick until the layout settles.
 * A team with a hub keeps the hub in the center and its other members on a ring around it.
 */
function useTeamLayout(teams: TeamGraphTeam[], cells: GraphCell[], hubs: number[]) {
  const [positions, setPositions] = useState<Map<string, GraphPoint>>(new Map());

  useEffect(() => {
    if (cells.length !== teams.length || cells.length === 0) return;
    const nodes: SimNode[] = teams.flatMap((team, teamIndex) => {
      const hub = hubs[teamIndex];
      const start = initialPositions(team.members.length, cells[teamIndex], hub);
      return team.members.map((member, i) => ({
        key: nodeKey(teamIndex, member.id),
        teamIndex,
        member,
        onRing: hub >= 0 && i !== hub,
        ...start[i],
        ...(i === hub && { fx: start[i].x, fy: start[i].y }),
      }));
    });
    const links: SimLink[] = teams.flatMap((team, teamIndex) =>
      team.links.map((link, linkIndex) => ({
        source: nodeKey(teamIndex, link.fromBotId),
        target: nodeKey(teamIndex, link.toBotId),
        teamIndex,
        linkIndex,
        curved: false,
      }))
    );

    const clamp = () => {
      for (const node of nodes) {
        const point = clampToCell({ x: node.x ?? 0, y: node.y ?? 0 }, cells[node.teamIndex]);
        node.x = point.x;
        node.y = point.y;
      }
    };
    const publish = () => setPositions(new Map(nodes.map((node) => [node.key, { x: node.x ?? 0, y: node.y ?? 0 }])));

    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((node) => node.key)
          .distance(TEAM_NODE_RADIUS * 5)
          .strength((link) => (hubs[link.teamIndex] >= 0 ? 0.05 : 0.4))
      )
      .force("ring", ringForce(cells, 0.3))
      .force("charge", forceManyBody<SimNode>().strength(-240).distanceMax(260))
      .force("collide", forceCollide<SimNode>(TEAM_NODE_RADIUS * 2.2))
      .force("x", forceX<SimNode>((node) => cellCenter(cells[node.teamIndex]).x).strength(0.06))
      .force("y", forceY<SimNode>((node) => cellCenter(cells[node.teamIndex]).y).strength(0.1))
      .alphaDecay(0.04);

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      simulation.stop();
      for (let i = 0; i < 200; i++) {
        simulation.tick();
        clamp();
      }
      publish();
    } else {
      simulation.on("tick", () => {
        clamp();
        publish();
      });
    }
    return () => {
      simulation.stop();
    };
  }, [teams, cells, hubs]);

  return positions;
}

function GraphNode({ member, point, href }: { member: Member; point: GraphPoint; href?: string }) {
  const Icon = BOT_ICON_COMPONENTS[member.icon ?? "bot"];
  const size = TEAM_NODE_RADIUS;
  const body = (
    <g transform={`translate(${point.x},${point.y})`}>
      <title>{[member.role ? `${member.title} · ${member.role}` : member.title, member.description].filter(Boolean).join("\n")}</title>
      <circle r={size} className="fill-background" />
      <circle r={size} strokeWidth={1.5} className={member.color ? NODE_STYLES[member.color] : DEFAULT_NODE_STYLE} />
      <Icon
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        aria-hidden="true"
        className={member.color ? NODE_STYLES[member.color] : DEFAULT_NODE_STYLE}
        style={{ fill: "none", stroke: "currentColor" }}
      />
      <text y={size + 14} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
        {truncateLabel(member.title, 16)}
      </text>
      {member.role && (
        <text y={size + 27} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {truncateLabel(member.role, 18)}
        </text>
      )}
    </g>
  );
  return href ? (
    <Link href={href} className="outline-none [&:focus-visible_circle]:stroke-primary">
      {body}
    </Link>
  ) : (
    body
  );
}

interface HoveredLink {
  teamIndex: number;
  linkIndex: number;
  point: GraphPoint;
}

interface BotTeamsGraphProps {
  teams: TeamGraphTeam[];
  /** "overview" makes each team box selectable and shows a detail panel; "single" links nodes to their bots */
  variant?: "overview" | "single";
}

export function BotTeamsGraph({ teams, variant = "overview" }: BotTeamsGraphProps) {
  const t = useTranslations("bots.teams");
  const markerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<HoveredLink | null>(null);
  const isOverview = variant === "overview";

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hubs = useMemo(() => teams.map((team) => findHub(team.members.map((m) => m.id), team.links)), [teams]);
  const layout = useMemo(
    () =>
      teamGridLayout(
        teams.map((team) => team.members.length),
        width,
        { minCellWidth: isOverview ? 300 : width, hubs: hubs.map((hub) => hub >= 0) }
      ),
    [teams, width, isOverview, hubs]
  );
  const positions = useTeamLayout(teams, width > 0 ? layout.cells : [], hubs);

  const reverseLinks = useMemo(
    () => teams.map((team) => new Set(team.links.map((link) => `${link.fromBotId}>${link.toBotId}`))),
    [teams]
  );

  const select = (index: number) => setSelected((current) => (current === index ? null : index));
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(index);
    }
  };

  const hoveredTeam = hovered ? teams[hovered.teamIndex] : null;
  const hoveredLink = hoveredTeam && hovered ? hoveredTeam.links[hovered.linkIndex] : null;
  const memberTitle = (team: TeamGraphTeam, botId: string) => team.members.find((m) => m.id === botId)?.title ?? "";
  const selectedTeam = selected !== null ? teams[selected] : null;

  const graph = (
    <div ref={containerRef} className="relative w-full min-w-0" style={{ minHeight: width > 0 ? layout.height : 240 }}>
      {width > 0 && (
        <svg
          width={width}
          height={layout.height}
          viewBox={`0 0 ${width} ${layout.height}`}
          role="group"
          aria-label={t("graphLabel")}
          className="block select-none"
        >
          <defs>
            <marker id={`${markerId}-arrow`} viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground/70" />
            </marker>
            <marker id={`${markerId}-arrow-active`} viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fill-primary" />
            </marker>
          </defs>

          {teams.map((team, teamIndex) => {
            const cell = layout.cells[teamIndex];
            if (!cell) return null;
            const isSelected = selected === teamIndex;
            const boxProps = isOverview
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-pressed": isSelected,
                  "aria-label": t("selectTeam", { team: team.title }),
                  onClick: () => select(teamIndex),
                  onKeyDown: (event: KeyboardEvent) => onKeyDown(event, teamIndex),
                  className: "cursor-pointer outline-none group",
                }
              : {};
            return (
              <g key={team.slug} {...boxProps}>
                <rect
                  x={cell.x + 0.5}
                  y={cell.y + 0.5}
                  width={cell.width - 1}
                  height={cell.height - 1}
                  rx={12}
                  strokeWidth={isSelected ? 2 : 1}
                  className={cn(
                    "fill-card transition-colors",
                    isSelected ? "stroke-primary" : "stroke-border",
                    isOverview && "group-hover:stroke-primary/60 group-focus-visible:stroke-primary"
                  )}
                />
                <text x={cell.x + 16} y={cell.y + 26} className="fill-foreground text-[13px] font-semibold">
                  {truncateLabel(team.title, Math.floor((cell.width - 56) / 7.5))}
                </text>
                {team.isFeatured && (
                  <Star x={cell.x + cell.width - 30} y={cell.y + 13} width={16} height={16} className="fill-yellow-500 text-yellow-500" aria-hidden="true" />
                )}

                {team.links.map((link, linkIndex) => {
                  const source = positions.get(nodeKey(teamIndex, link.fromBotId));
                  const target = positions.get(nodeKey(teamIndex, link.toBotId));
                  if (!source || !target) return null;
                  const curved = reverseLinks[teamIndex].has(`${link.toBotId}>${link.fromBotId}`);
                  const edge = edgeGeometry(source, target, { curve: curved ? 22 : 0 });
                  if (!edge) return null;
                  const isHovered = hovered?.teamIndex === teamIndex && hovered.linkIndex === linkIndex;
                  const description = t("handoffLabel", {
                    from: memberTitle(team, link.fromBotId),
                    to: memberTitle(team, link.toBotId),
                  });
                  return (
                    <g
                      key={`${link.fromBotId}>${link.toBotId}`}
                      onMouseEnter={() => setHovered({ teamIndex, linkIndex, point: edge.mid })}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <title>{link.label ? `${description}: ${link.label}` : description}</title>
                      <path d={edge.d} fill="none" stroke="transparent" strokeWidth={14} />
                      <path
                        d={edge.d}
                        fill="none"
                        strokeWidth={isHovered ? 2.25 : 1.5}
                        markerEnd={`url(#${markerId}-${isHovered ? "arrow-active" : "arrow"})`}
                        className={isHovered ? "stroke-primary" : "stroke-muted-foreground/60"}
                      />
                    </g>
                  );
                })}

                {team.members.map((member) => {
                  const point = positions.get(nodeKey(teamIndex, member.id));
                  if (!point) return null;
                  return (
                    <GraphNode
                      key={member.id}
                      member={member}
                      point={point}
                      href={isOverview ? undefined : getBotUrl(member.id, member.slug)}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}

      {hovered && hoveredTeam && hoveredLink && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 max-w-64 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: hovered.point.x, top: hovered.point.y - 8 }}
        >
          <p className="flex items-center gap-1 font-medium">
            <span className="truncate">{memberTitle(hoveredTeam, hoveredLink.fromBotId)}</span>
            <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{memberTitle(hoveredTeam, hoveredLink.toBotId)}</span>
          </p>
          <p className="mt-0.5 text-muted-foreground wrap-anywhere">{hoveredLink.label || t("noHandoffLabel")}</p>
        </div>
      )}
    </div>
  );

  if (!isOverview) return graph;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      {graph}
      <aside aria-live="polite" className="h-fit min-w-0 rounded-md border p-4 lg:sticky lg:top-16">
        {selectedTeam ? <TeamDetailPanel team={selectedTeam} onClose={() => setSelected(null)} /> : (
          <p className="text-sm text-muted-foreground">{t("selectHint")}</p>
        )}
      </aside>
    </div>
  );
}

function TeamDetailPanel({ team, onClose }: { team: TeamGraphTeam; onClose: () => void }) {
  const t = useTranslations("bots.teams");
  const titles = new Map(team.members.map((member) => [member.id, member.title]));
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold wrap-anywhere">{team.title}</h2>
          <p className="text-xs text-muted-foreground">{t("by", { author: team.author })}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label={t("closePanel")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {team.description && <TeamMarkdown className="max-h-64 overflow-y-auto text-sm">{team.description}</TeamMarkdown>}

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("members")}</h3>
        <ul className="space-y-2">
          {team.members.map((member) => (
            <li key={member.id} className="flex min-w-0 items-start gap-2">
              <BotAvatar icon={member.icon} color={member.color} size="sm" />
              <div className="min-w-0">
                <Link href={getBotUrl(member.id, member.slug)} className="block truncate text-sm font-medium hover:underline">
                  {member.title}
                </Link>
                {member.role && <p className="truncate text-xs font-medium text-muted-foreground">{member.role}</p>}
                {member.description && <p className="line-clamp-3 text-xs text-muted-foreground wrap-anywhere">{member.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("handoffs")}</h3>
        {team.links.length > 0 ? (
          <ul className="space-y-2">
            {team.links.map((link) => (
              <li key={`${link.fromBotId}>${link.toBotId}`} className="text-sm">
                <span className="flex min-w-0 items-center gap-1 font-medium">
                  <span className="truncate">{titles.get(link.fromBotId)}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label={t("handsOffTo")} />
                  <span className="truncate">{titles.get(link.toBotId)}</span>
                </span>
                {link.label && <span className="block text-xs text-muted-foreground wrap-anywhere">{link.label}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noHandoffs")}</p>
        )}
      </section>

      <Button size="sm" className="w-full" asChild>
        <Link href={getBotTeamUrl(team.slug)}>{t("openTeam")}</Link>
      </Button>
    </div>
  );
}
