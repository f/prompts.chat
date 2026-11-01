import { describe, it, expect } from "vitest";
import { TEAM_BOX_FOOTER, WIDGET_CELL_HEIGHT, teamGridLayout, teamGridLayoutWithWidgets } from "@/lib/bots/team-graph";

describe("teamGridLayout fixed heights", () => {
  it("uses a fixed height instead of the team's fitted height", () => {
    const fitted = teamGridLayout([2], 320, { footer: TEAM_BOX_FOOTER }).cells[0].height;
    const fixed = teamGridLayout([2], 320, { footer: TEAM_BOX_FOOTER, fixedHeights: [fitted + 100] }).cells[0].height;
    expect(fixed).toBe(fitted + 100);
  });

  it("makes a row as tall as its tallest cell, fixed or fitted", () => {
    const { cells } = teamGridLayout([2, 0], 700, { fixedHeights: [undefined, 900] });
    expect(cells.map((cell) => cell.height)).toEqual([900, 900]);
  });
});

describe("teamGridLayoutWithWidgets", () => {
  it("matches the plain layout without widgets", () => {
    const plain = teamGridLayout([2, 3, 4], 1000, { footer: TEAM_BOX_FOOTER });
    const withWidgets = teamGridLayoutWithWidgets([2, 3, 4], [], 1000, { footer: TEAM_BOX_FOOTER });
    expect(withWidgets.cells).toEqual(plain.cells);
    expect(withWidgets.widgetCells).toEqual([]);
    expect(withWidgets.height).toBe(plain.height);
  });

  it("places a widget cell at its slot and shifts the following teams", () => {
    // Three columns: team, team, widget / team, team
    const { cells, widgetCells, columns } = teamGridLayoutWithWidgets([2, 2, 2, 2], [2], 1000, { footer: TEAM_BOX_FOOTER });
    expect(columns).toBe(3);
    expect(cells).toHaveLength(4);
    expect(widgetCells).toHaveLength(1);
    expect(widgetCells[0].x).toBeGreaterThan(cells[1].x);
    expect(widgetCells[0].y).toBe(cells[0].y);
    expect(cells[2]).toMatchObject({ x: cells[0].x });
    expect(cells[2].y).toBeGreaterThan(cells[0].y);
  });

  it("gives widget cells at least the widget height", () => {
    const { widgetCells } = teamGridLayoutWithWidgets([2], [0], 320, { footer: TEAM_BOX_FOOTER });
    expect(widgetCells[0].height).toBeGreaterThanOrEqual(WIDGET_CELL_HEIGHT);
    expect(widgetCells[0].width).toBe(320);
  });

  it("stacks every cell in one column on narrow screens", () => {
    const { cells, widgetCells, height } = teamGridLayoutWithWidgets([2, 3], [1], 360, { footer: TEAM_BOX_FOOTER });
    expect([cells[0].x, widgetCells[0].x, cells[1].x]).toEqual([0, 0, 0]);
    expect(cells[0].y).toBeLessThan(widgetCells[0].y);
    expect(widgetCells[0].y).toBeLessThan(cells[1].y);
    expect(height).toBe(cells[1].y + cells[1].height);
  });

  it("appends a widget slotted after the last team", () => {
    const { cells, widgetCells } = teamGridLayoutWithWidgets([2, 2], [2], 360);
    expect(cells).toHaveLength(2);
    expect(widgetCells[0].y).toBeGreaterThan(cells[1].y);
  });
});
