import { describe, it, expect } from "vitest";
import { diffItemLists, textItems } from "@/lib/list-diff";

describe("diffItemLists", () => {
  it("keeps items on both sides unchanged and reports only additions and removals", () => {
    expect(diffItemLists(textItems(["OpenClaw"]), textItems(["OpenClaw", "Hermes Agent"]))).toEqual([
      { type: "unchanged", key: "OpenClaw", text: "OpenClaw" },
      { type: "added", key: "Hermes Agent", text: "Hermes Agent" },
    ]);
    expect(diffItemLists(textItems(["CLOUD", "LOCAL"]), textItems(["LOCAL"]))).toEqual([
      { type: "removed", key: "CLOUD", text: "CLOUD" },
      { type: "unchanged", key: "LOCAL", text: "LOCAL" },
    ]);
  });

  it("replaces one item without touching its neighbours", () => {
    expect(diffItemLists(textItems(["github", "jira", "slack"]), textItems(["github", "linear", "slack"]))).toEqual([
      { type: "unchanged", key: "github", text: "github" },
      { type: "removed", key: "jira", text: "jira" },
      { type: "added", key: "linear", text: "linear" },
      { type: "unchanged", key: "slack", text: "slack" },
    ]);
  });

  it("reports a kept item with new text as changed", () => {
    expect(diffItemLists([{ key: "triage", text: "Triage: old" }], [{ key: "triage", text: "Triage: new" }])).toEqual([
      { type: "changed", key: "triage", original: "Triage: old", modified: "Triage: new" },
    ]);
  });

  it("handles empty lists", () => {
    expect(diffItemLists([], [])).toEqual([]);
    expect(diffItemLists([], textItems(["a"]))).toEqual([{ type: "added", key: "a", text: "a" }]);
    expect(diffItemLists(textItems(["a"]), [])).toEqual([{ type: "removed", key: "a", text: "a" }]);
  });
});
