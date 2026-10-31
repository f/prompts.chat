"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  drag,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  select as d3Select,
  type DragBehavior,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  type SubjectPosition,
} from "d3";
import { ArrowRight, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotAvatar, BOT_ICON_COMPONENTS } from "@/components/bots/bot-avatar";
import { BotComputerBadges, COMPUTER_REQUIREMENT_ICONS, COMPUTER_REQUIREMENT_LABELS } from "@/components/bots/bot-computer-badge";
import { normalizeComputerRequirements, type BotColor } from "@/lib/bots/schema";
import { TeamMarkdown } from "@/components/bots/teams/team-markdown";
import { BotTeamMemberDialog } from "@/components/bots/teams/bot-team-member-dialog";
import { TeamInstall } from "@/components/bots/teams/team-install";
import { PromptAuthor } from "@/components/prompts/prompt-author";
import { UpvoteButton } from "@/components/prompts/upvote-button";
import {
  NODE_BADGE_OFFSET,
  NODE_BADGE_RADIUS,
  NODE_ROLE_MAX,
  NODE_ROLE_OFFSET,
  NODE_TITLE_MAX,
  NODE_TITLE_OFFSET,
  TEAM_BOX_FOOTER,
  TEAM_NODE_RADIUS,
  cellCenter,
  clampToCell,
  edgeGeometry,
  findHub,
  initialPositions,
  nodeExtent,
  ringTarget,
  teamGridLayout,
  truncateLabel,
  type GraphCell,
  type GraphPoint,
  type NodeExtent,
  type TeamGraphTeam,
} from "@/lib/bots/team-graph";
import { getBotTeamUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

type Member = TeamGraphTeam["members"][number];

interface SimNode extends SimulationNodeDatum {
  key: string;
  teamIndex: number;
  member: Member;
  /** Sits on the ring around its team's hub */
  onRing: boolean;
  /** How far the node's circle, badge and labels reach, to keep all of it inside the box */
  extent: NodeExtent;
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

/** Pointer movement in pixels up to which a press on a node still counts as a click that opens it */
const DRAG_CLICK_DISTANCE = 4;

type NodeDrag = DragBehavior<SVGGElement, unknown, SubjectPosition>;

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
 * Every node, labels included, is kept inside its cell. Also returns a drag behavior for node
 * elements marked with `data-node-key`, which moves a node within its cell and reheats the layout.
 */
function useTeamLayout(teams: TeamGraphTeam[], cells: GraphCell[], hubs: number[]) {
  const [positions, setPositions] = useState<Map<string, GraphPoint>>(new Map());
  const [nodeDrag, setNodeDrag] = useState<NodeDrag | null>(null);

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
        extent: nodeExtent(member),
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
        const point = clampToCell({ x: node.x ?? 0, y: node.y ?? 0 }, cells[node.teamIndex], node.extent);
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
      .force("collide", forceCollide<SimNode>((node) => Math.max(TEAM_NODE_RADIUS * 2.2, (node.extent.left + node.extent.right) / 2 + 4)))
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
    }
    simulation.on("tick", () => {
      clamp();
      publish();
    });

    const byKey = new Map(nodes.map((node) => [node.key, node]));
    const nodeOf = (element: SVGGElement) => byKey.get(element.dataset.nodeKey ?? "");
    const behavior: NodeDrag = drag<SVGGElement, unknown, SubjectPosition>()
      .clickDistance(DRAG_CLICK_DISTANCE)
      .subject(function () {
        const node = nodeOf(this);
        return { x: node?.x ?? 0, y: node?.y ?? 0 };
      })
      .on("start", function (event) {
        const node = nodeOf(this);
        if (!node) return;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", function (event) {
        const node = nodeOf(this);
        if (!node) return;
        const point = clampToCell({ x: event.x, y: event.y }, cells[node.teamIndex], node.extent);
        node.fx = point.x;
        node.fy = point.y;
      })
      .on("end", function (event) {
        const node = nodeOf(this);
        if (!event.active) simulation.alphaTarget(0);
        if (!node) return;
        node.fx = null;
        node.fy = null;
      });
    setNodeDrag(() => behavior);

    return () => {
      simulation.stop();
    };
  }, [teams, cells, hubs]);

  return { positions, nodeDrag };
}

function GraphNode({ member, point, dragKey, onOpen }: { member: Member; point: GraphPoint; dragKey: string; onOpen: () => void }) {
  const t = useTranslations("bots.teams");
  const tComputer = useTranslations("bots.computer");
  const Icon = BOT_ICON_COMPONENTS[member.icon ?? "bot"];
  const size = TEAM_NODE_RADIUS;
  const computers = normalizeComputerRequirements(member.computerRequirements);
  const tooltip = [
    member.role ? `${member.title} · ${member.role}` : member.title,
    ...computers.map((computer) => tComputer(COMPUTER_REQUIREMENT_LABELS[computer])),
    member.description,
  ];
  return (
    <g
      transform={`translate(${point.x},${point.y})`}
      data-node-key={dragKey}
      role="button"
      tabIndex={0}
      aria-label={t("openBot", { bot: member.title })}
      className="cursor-pointer outline-none [&:focus-visible>circle:nth-of-type(2)]:stroke-primary [&:hover>circle:nth-of-type(2)]:stroke-[2.5]"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
    >
      <title>{tooltip.filter(Boolean).join("\n")}</title>
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
      {computers.map((computer, index) => {
        const ComputerIcon = COMPUTER_REQUIREMENT_ICONS[computer];
        // One mark sits top right; with two, the first moves to top left so neither covers the other
        const x = computers.length > 1 && index === 0 ? -NODE_BADGE_OFFSET : NODE_BADGE_OFFSET;
        return (
          <g key={computer} transform={`translate(${x},${-NODE_BADGE_OFFSET})`} aria-hidden="true">
            <circle r={NODE_BADGE_RADIUS} strokeWidth={1} className="fill-background stroke-border" />
            <ComputerIcon x={-5} y={-5} width={10} height={10} className="text-muted-foreground" />
          </g>
        );
      })}
      <text y={NODE_TITLE_OFFSET} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
        {truncateLabel(member.title, NODE_TITLE_MAX)}
      </text>
      {member.role && (
        <text y={NODE_ROLE_OFFSET} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {truncateLabel(member.role, NODE_ROLE_MAX)}
        </text>
      )}
    </g>
  );
}

interface HoveredLink {
  teamIndex: number;
  linkIndex: number;
  point: GraphPoint;
}

interface BotTeamsGraphProps {
  teams: TeamGraphTeam[];
  /**
   * "overview" makes each team box selectable, adds the author, upvotes and install to its footer,
   * and shows a detail panel; bots open a details dialog in both
   */
  variant?: "overview" | "single";
  isLoggedIn?: boolean;
}

export function BotTeamsGraph({ teams, variant = "overview", isLoggedIn = false }: BotTeamsGraphProps) {
  const t = useTranslations("bots.teams");
  const markerId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<HoveredLink | null>(null);
  const [openMember, setOpenMember] = useState<{ teamIndex: number; memberId: string } | null>(null);
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
        { minCellWidth: isOverview ? 300 : width, hubs: hubs.map((hub) => hub >= 0), footer: isOverview ? TEAM_BOX_FOOTER : 0 }
      ),
    [teams, width, isOverview, hubs]
  );
  const { positions, nodeDrag } = useTeamLayout(teams, width > 0 ? layout.cells : [], hubs);
  const hasNodes = positions.size > 0;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !nodeDrag || !hasNodes) return;
    const nodes = d3Select(svg).selectAll<SVGGElement, unknown>("[data-node-key]");
    nodes.call(nodeDrag);
    return () => {
      nodes.on(".drag", null);
    };
  }, [nodeDrag, hasNodes]);

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
  const openTeam = openMember ? teams[openMember.teamIndex] : null;
  const dialog = (
    <BotTeamMemberDialog
      member={openTeam?.members.find((member) => member.id === openMember?.memberId) ?? null}
      teamTitle={openTeam?.title ?? ""}
      onOpenChange={(open) => !open && setOpenMember(null)}
    />
  );

  const graph = (
    <div ref={containerRef} className="relative w-full min-w-0" style={{ minHeight: width > 0 ? layout.height : 240 }}>
      {width > 0 && (
        <svg
          ref={svgRef}
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
                  rx={10}
                  strokeWidth={1}
                  className={cn(
                    "fill-card transition-colors [rx:var(--radius)]",
                    isSelected ? "stroke-foreground/50" : "stroke-border",
                    isOverview && !isSelected && "group-hover:stroke-foreground/30 group-focus-visible:stroke-foreground/50"
                  )}
                />
                <text x={cell.x + 16} y={cell.y + 28} className="fill-foreground text-sm font-semibold">
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
                      dragKey={nodeKey(teamIndex, member.id)}
                      onOpen={() => setOpenMember({ teamIndex, memberId: member.id })}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      )}

      {isOverview &&
        width > 0 &&
        teams.map((team, teamIndex) => {
          const cell = layout.cells[teamIndex];
          if (!cell) return null;
          return (
            <div
              key={team.slug}
              className="pointer-events-none absolute flex items-stretch px-4"
              style={{ left: cell.x, top: cell.y + cell.height - TEAM_BOX_FOOTER, width: cell.width, height: TEAM_BOX_FOOTER }}
            >
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 border-t text-[11px] text-muted-foreground">
                <PromptAuthor author={team.author} className="pointer-events-auto" />
                <div className="pointer-events-auto flex shrink-0 items-center gap-3">
                  <UpvoteButton
                    voteUrl={`/api/bots/teams/${encodeURIComponent(team.slug)}/vote`}
                    initialVoted={team.voted}
                    initialCount={team.voteCount}
                    isLoggedIn={isLoggedIn}
                    size="sm"
                  />
                  {team.installable && (
                    <TeamInstall
                      team={{ id: team.id, slug: team.slug, title: team.title, memberCount: team.members.length }}
                      variant="card"
                      className="h-7 px-2.5"
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

      {hovered && hoveredTeam && hoveredLink && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 max-w-64 -translate-x-1/2 -translate-y-full rounded-md bg-foreground px-3 py-1.5 text-xs text-background"
          style={{ left: hovered.point.x, top: hovered.point.y - 8 }}
        >
          <p className="flex items-center gap-1 font-medium">
            <span className="truncate">{memberTitle(hoveredTeam, hoveredLink.fromBotId)}</span>
            <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{memberTitle(hoveredTeam, hoveredLink.toBotId)}</span>
          </p>
          <p className="mt-0.5 text-background/70 wrap-anywhere">{hoveredLink.label || t("noHandoffLabel")}</p>
        </div>
      )}
    </div>
  );

  if (!isOverview) {
    return (
      <>
        {graph}
        {dialog}
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {graph}
      <aside aria-live="polite" className="h-fit min-w-0 space-y-3 rounded-md border p-3 sm:p-4 lg:sticky lg:top-16">
        {selectedTeam ? (
          <TeamDetailPanel
            team={selectedTeam}
            onClose={() => setSelected(null)}
            onOpenMember={(memberId) => selected !== null && setOpenMember({ teamIndex: selected, memberId })}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("selectHint")}</p>
        )}
      </aside>
      {dialog}
    </div>
  );
}

function TeamDetailPanel({
  team,
  onClose,
  onOpenMember,
}: {
  team: TeamGraphTeam;
  onClose: () => void;
  onOpenMember: (memberId: string) => void;
}) {
  const t = useTranslations("bots.teams");
  const titles = new Map(team.members.map((member) => [member.id, member.title]));
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold wrap-anywhere">{team.title}</h2>
          <PromptAuthor author={team.author} className="mt-1 text-xs text-muted-foreground" />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label={t("closePanel")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {team.description && <TeamMarkdown className="max-h-64 overflow-y-auto text-sm text-muted-foreground">{team.description}</TeamMarkdown>}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("members")}</h3>
        <ul className="-mx-2 space-y-0.5">
          {team.members.map((member) => (
            <li key={member.id} className="flex min-w-0 items-start gap-1">
              <button
                type="button"
                onClick={() => onOpenMember(member.id)}
                className="flex min-w-0 flex-1 items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BotAvatar icon={member.icon} color={member.color} size="sm" />
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate text-sm font-medium">{member.title}</span>
                  {member.role && <span className="block truncate text-xs text-muted-foreground">{member.role}</span>}
                  {member.description && (
                    <span className="line-clamp-2 text-xs text-muted-foreground wrap-anywhere">{member.description}</span>
                  )}
                </span>
              </button>
              <BotComputerBadges requirements={member.computerRequirements} className="mt-2.5" />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("handoffs")}</h3>
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

      <Button size="sm" className="h-8 w-full text-xs" asChild>
        <Link href={getBotTeamUrl(team.slug)}>
          {t("openTeam")}
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Link>
      </Button>
    </div>
  );
}
