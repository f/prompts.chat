import type { BotColor, BotIconName } from "./schema";

/** Geometry for the bot teams graph: one box per team on a responsive grid, bots as nodes inside */

/** A team as the graph and its detail panel draw it; plain data so it can cross to the client */
export interface TeamGraphTeam {
  slug: string;
  title: string;
  description: string | null;
  author: string;
  isFeatured: boolean;
  members: { id: string; slug: string | null; title: string; icon: BotIconName | null; color: BotColor | null; role: string | null }[];
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
}

export const TEAM_NODE_RADIUS = 20;
/** Space at the top of a team box for its title */
export const TEAM_BOX_HEADER = 44;
/** Inner padding between a team box's border and its nodes, leaving room for node labels */
export const TEAM_BOX_PADDING = 28;
const NODE_SLOT_WIDTH = 104;
const NODE_SLOT_HEIGHT = 84;
const ARROW_SIZE = 7;

/** Height of a team box that fits `size` nodes in rows across the given width */
export function teamCellHeight(size: number, width: number): number {
  const perRow = Math.max(1, Math.floor((width - TEAM_BOX_PADDING * 2) / NODE_SLOT_WIDTH));
  const rows = Math.max(1, Math.ceil(size / perRow));
  return Math.max(200, TEAM_BOX_HEADER + TEAM_BOX_PADDING * 2 + rows * NODE_SLOT_HEIGHT);
}

/**
 * Places one cell per team, left to right in as many columns of at least minCellWidth as fit.
 * Each row is as tall as its tallest team.
 */
export function teamGridLayout(
  teamSizes: number[],
  width: number,
  { minCellWidth = 300, gap = 16 }: { minCellWidth?: number; gap?: number } = {}
): { cells: GraphCell[]; height: number; columns: number } {
  const columns = Math.max(1, Math.min(teamSizes.length || 1, Math.floor((width + gap) / (minCellWidth + gap))));
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cells: GraphCell[] = [];
  let y = 0;
  for (let start = 0; start < teamSizes.length; start += columns) {
    const row = teamSizes.slice(start, start + columns);
    const rowHeight = Math.max(...row.map((size) => teamCellHeight(size, cellWidth)));
    row.forEach((_, column) => cells.push({ x: column * (cellWidth + gap), y, width: cellWidth, height: rowHeight }));
    y += rowHeight + gap;
  }
  return { cells, height: Math.max(0, y - gap), columns };
}

/** The area of a cell that node centers may occupy */
export function nodeBounds(cell: GraphCell, radius = TEAM_NODE_RADIUS) {
  return {
    minX: cell.x + TEAM_BOX_PADDING + radius / 2,
    maxX: cell.x + cell.width - TEAM_BOX_PADDING - radius / 2,
    minY: cell.y + TEAM_BOX_HEADER + radius,
    maxY: cell.y + cell.height - TEAM_BOX_PADDING - radius / 2,
  };
}

export function clampToCell(point: GraphPoint, cell: GraphCell, radius = TEAM_NODE_RADIUS): GraphPoint {
  const { minX, maxX, minY, maxY } = nodeBounds(cell, radius);
  return { x: Math.min(maxX, Math.max(minX, point.x)), y: Math.min(maxY, Math.max(minY, point.y)) };
}

export function cellCenter(cell: GraphCell): GraphPoint {
  const { minY, maxY } = nodeBounds(cell);
  return { x: cell.x + cell.width / 2, y: (minY + maxY) / 2 };
}

/** Starting positions: evenly spaced on a circle around the cell's center, first member on the left */
export function initialPositions(count: number, cell: GraphCell): GraphPoint[] {
  const center = cellCenter(cell);
  if (count === 1) return [center];
  const { minX, maxX, minY, maxY } = nodeBounds(cell);
  const rx = Math.max(0, (maxX - minX) / 2 - 8);
  const ry = Math.max(0, (maxY - minY) / 2 - 8);
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.PI + (2 * Math.PI * i) / count;
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
