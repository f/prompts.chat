import type { BotColor, BotComputerRequirement, BotIconName } from "./schema";

/** Geometry for the bot teams graph: one box per team on a responsive grid, bots as nodes inside */

/** A team as the graph and its detail panel draw it; plain data so it can cross to the client */
export interface TeamGraphTeam {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  author: { username: string; name: string | null; avatar: string | null; verified: boolean };
  isFeatured: boolean;
  voteCount: number;
  /** The viewer has upvoted the team */
  voted: boolean;
  /** At least one member runs on a platform the team can be installed on */
  installable: boolean;
  members: {
    id: string;
    slug: string | null;
    title: string;
    icon: BotIconName | null;
    color: BotColor | null;
    computerRequirements: BotComputerRequirement[];
    role: string | null;
    description: string | null;
  }[];
  links: { fromBotId: string; toBotId: string; label: string }[];
}

export interface GraphPoint {
  x: number;
  y: number;
}

export interface GraphCell {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Space at the bottom of the box kept free of nodes, e.g. for the team's author and actions */
  footer?: number;
}

/** How far a node's drawing (circle, badge and labels) reaches from its center in each direction */
export interface NodeExtent {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export const TEAM_NODE_RADIUS = 20;
/** Space at the top of a team box for its title */
export const TEAM_BOX_HEADER = 44;
/** Gap between a team box's border and the outermost node drawing */
export const TEAM_BOX_INSET = 12;
/** Height of the footer row of a team box in the overview */
export const TEAM_BOX_FOOTER = 44;
/** Baselines of a node's name and role, below its center */
export const NODE_TITLE_OFFSET = TEAM_NODE_RADIUS + 14;
export const NODE_ROLE_OFFSET = TEAM_NODE_RADIUS + 27;
export const NODE_TITLE_MAX = 16;
export const NODE_ROLE_MAX = 18;
/** Computer badges sit on the node's top-right edge, and with two, also on its top-left edge */
export const NODE_BADGE_OFFSET = TEAM_NODE_RADIUS * 0.75;
export const NODE_BADGE_RADIUS = 8;
const NODE_SLOT_WIDTH = 112;
const NODE_SLOT_HEIGHT = 88;
const ARROW_SIZE = 7;
/** Spacing between neighbors on a hub's ring */
const RING_SLOT = 78;
/** Average glyph widths of the 11px name and 10px role labels; deliberately generous */
const TITLE_CHAR_WIDTH = 6.6;
const ROLE_CHAR_WIDTH = 6;
/** Room below a label baseline for descenders */
const LABEL_DESCENT = 4;

/**
 * The area a node draws into around its center: its circle, the computer badge, and its name and
 * role labels, which are usually wider than the circle
 */
export function nodeExtent({ title, role }: { title: string; role?: string | null }): NodeExtent {
  const titleWidth = truncateLabel(title, NODE_TITLE_MAX).length * TITLE_CHAR_WIDTH;
  const roleWidth = role ? truncateLabel(role, NODE_ROLE_MAX).length * ROLE_CHAR_WIDTH : 0;
  const halfLabel = Math.ceil(Math.max(titleWidth, roleWidth) / 2);
  const badge = NODE_BADGE_OFFSET + NODE_BADGE_RADIUS;
  return {
    left: Math.max(badge, halfLabel),
    right: Math.max(badge, halfLabel),
    top: Math.max(TEAM_NODE_RADIUS, badge),
    bottom: (role ? NODE_ROLE_OFFSET : NODE_TITLE_OFFSET) + LABEL_DESCENT,
  };
}

/** The extent of a node with the longest name and a role, used to size boxes and rings */
export const MAX_NODE_EXTENT: NodeExtent = nodeExtent({ title: "W".repeat(NODE_TITLE_MAX), role: "W".repeat(NODE_ROLE_MAX) });

/**
 * The member most others hand work to and from, like a "chief of staff" bot: it is connected to
 * at least three members, and to more members than anyone else. -1 when the team has no hub.
 */
export function findHub(memberIds: readonly string[], links: readonly { fromBotId: string; toBotId: string }[]): number {
  const neighbors = new Map(memberIds.map((id) => [id, new Set<string>()]));
  for (const { fromBotId, toBotId } of links) {
    if (fromBotId === toBotId || !neighbors.has(fromBotId) || !neighbors.has(toBotId)) continue;
    neighbors.get(fromBotId)!.add(toBotId);
    neighbors.get(toBotId)!.add(fromBotId);
  }
  const counts = memberIds.map((id) => neighbors.get(id)!.size);
  const most = Math.max(0, ...counts);
  if (most < 3 || counts.filter((count) => count === most).length > 1) return -1;
  return counts.indexOf(most);
}

/** Radius of the ring that fits `count` nodes around a hub */
function ringRadius(count: number): number {
  return Math.max(70, (count * RING_SLOT) / (2 * Math.PI));
}

/**
 * Height of a team box that fits `size` nodes in rows across the given width, or, for a team with
 * a hub, the hub and a ring of its neighbors around it
 */
export function teamCellHeight(size: number, width: number, hub = false, footer = 0): number {
  const { left, right, top, bottom } = MAX_NODE_EXTENT;
  const perRow = Math.max(1, 1 + Math.floor((width - TEAM_BOX_INSET * 2 - left - right) / NODE_SLOT_WIDTH));
  const rows = Math.max(1, Math.ceil(size / perRow));
  const chrome = TEAM_BOX_HEADER + top + bottom + TEAM_BOX_INSET + footer;
  const grid = chrome + rows * NODE_SLOT_HEIGHT;
  const ring = hub ? chrome + 2 * ringRadius(size - 1) : 0;
  return Math.ceil(Math.max(200 + footer, grid, ring));
}

/**
 * Places one cell per team, left to right in as many columns of at least minCellWidth as fit.
 * Each row is as tall as its tallest team.
 */
export function teamGridLayout(
  teamSizes: number[],
  width: number,
  {
    minCellWidth = 300,
    gap = 16,
    hubs = [],
    footer = 0,
  }: { minCellWidth?: number; gap?: number; hubs?: boolean[]; footer?: number } = {}
): { cells: GraphCell[]; height: number; columns: number } {
  const columns = Math.max(1, Math.min(teamSizes.length || 1, Math.floor((width + gap) / (minCellWidth + gap))));
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cells: GraphCell[] = [];
  let y = 0;
  for (let start = 0; start < teamSizes.length; start += columns) {
    const row = teamSizes.slice(start, start + columns);
    const rowHeight = Math.max(...row.map((size, column) => teamCellHeight(size, cellWidth, hubs[start + column], footer)));
    row.forEach((_, column) => cells.push({ x: column * (cellWidth + gap), y, width: cellWidth, height: rowHeight, footer }));
    y += rowHeight + gap;
  }
  return { cells, height: Math.max(0, y - gap), columns };
}

/**
 * The area of a cell that centers of nodes with the given extent may occupy, so the whole node,
 * labels and badge included, stays inside the box. When the box is too small for the node, both
 * ends of a range meet in its middle.
 */
export function nodeBounds(cell: GraphCell, extent: NodeExtent = MAX_NODE_EXTENT) {
  let minX = cell.x + TEAM_BOX_INSET + extent.left;
  let maxX = cell.x + cell.width - TEAM_BOX_INSET - extent.right;
  let minY = cell.y + TEAM_BOX_HEADER + extent.top;
  let maxY = cell.y + cell.height - (cell.footer ?? 0) - TEAM_BOX_INSET - extent.bottom;
  if (minX > maxX) minX = maxX = (minX + maxX) / 2;
  if (minY > maxY) minY = maxY = (minY + maxY) / 2;
  return { minX, maxX, minY, maxY };
}

export function clampToCell(point: GraphPoint, cell: GraphCell, extent: NodeExtent = MAX_NODE_EXTENT): GraphPoint {
  const { minX, maxX, minY, maxY } = nodeBounds(cell, extent);
  return { x: Math.min(maxX, Math.max(minX, point.x)), y: Math.min(maxY, Math.max(minY, point.y)) };
}

export function cellCenter(cell: GraphCell): GraphPoint {
  const { minX, maxX, minY, maxY } = nodeBounds(cell);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/** The ellipse a hub's neighbors sit on: as large as the cell allows with every node fully inside */
export function ringRadii(cell: GraphCell): { rx: number; ry: number } {
  const { minX, maxX, minY, maxY } = nodeBounds(cell);
  return { rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
}

/** Where a hub's neighbors are pulled to: the point of the ring in the direction of `point` */
export function ringTarget(point: GraphPoint, cell: GraphCell): GraphPoint {
  const center = cellCenter(cell);
  const { rx, ry } = ringRadii(cell);
  const angle = Math.atan2(point.y - center.y, point.x - center.x);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  if (rx === 0 || ry === 0) return { x: center.x + rx * cos, y: center.y + ry * sin };
  const distance = 1 / Math.sqrt((cos * cos) / (rx * rx) + (sin * sin) / (ry * ry));
  return { x: center.x + distance * cos, y: center.y + distance * sin };
}

/**
 * Starting positions, first member on the left: evenly spaced on an ellipse around the cell's
 * center, or with the hub (an index from findHub) in the center and everyone else around it
 */
export function initialPositions(count: number, cell: GraphCell, hub = -1): GraphPoint[] {
  const center = cellCenter(cell);
  if (count === 1) return [center];
  const { rx, ry } = ringRadii(cell);
  const ringSize = hub >= 0 ? count - 1 : count;
  // Around a hub, start at the top and keep neighbors off the hub's horizontal line, where their
  // labels would run into the hub's label
  const start = hub >= 0 ? -Math.PI / 2 + (ringSize % 4 === 0 ? Math.PI / ringSize : 0) : Math.PI;
  let slot = 0;
  return Array.from({ length: count }, (_, i) => {
    if (i === hub) return center;
    const angle = start + (2 * Math.PI * slot++) / ringSize;
    return { x: center.x + rx * Math.cos(angle), y: center.y + ry * Math.sin(angle) };
  });
}

/**
 * An edge from the border of the source node to just before the border of the target node,
 * leaving room for the arrowhead. `curve` bends it sideways, so two opposite handoffs between
 * the same bots do not overlap. `mid` is where a label for the edge belongs.
 */
export function edgeGeometry(
  source: GraphPoint,
  target: GraphPoint,
  { radius = TEAM_NODE_RADIUS, curve = 0 }: { radius?: number; curve?: number } = {}
): { d: string; mid: GraphPoint } | null {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius * 2 + ARROW_SIZE) return null;
  const ux = dx / distance;
  const uy = dy / distance;
  const start = { x: source.x + ux * radius, y: source.y + uy * radius };
  const end = { x: target.x - ux * (radius + ARROW_SIZE), y: target.y - uy * (radius + ARROW_SIZE) };
  const round = (n: number) => Math.round(n * 10) / 10;

  if (!curve) {
    return {
      d: `M${round(start.x)},${round(start.y)} L${round(end.x)},${round(end.y)}`,
      mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
    };
  }
  const control = { x: (start.x + end.x) / 2 - uy * curve, y: (start.y + end.y) / 2 + ux * curve };
  return {
    d: `M${round(start.x)},${round(start.y)} Q${round(control.x)},${round(control.y)} ${round(end.x)},${round(end.y)}`,
    mid: { x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y },
  };
}

/** Shortens text to fit about `max` characters */
export function truncateLabel(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…` : text;
}
