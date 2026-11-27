import { describe, it, expect } from "vitest";
import { diffChips, diffItemLists, textItems } from "@/lib/list-diff";

describe("diffChips", () => {
  it("gives one chip per item with its kind", () => {
    expect(diffChips(textItems(["OpenClaw", "Hermes Agent"]), textItems(["Grok Bot", "OpenClaw"])).map(({ text, kind }) => [text, kind])).toEqual([
      ["Grok Bot", "added"],
      ["OpenClaw", "unchanged"],
      ["Hermes Agent", "removed"],
    ]);
  });

  it("shows a relabelled item as its old label removed and new label added", () => {
    expect(diffChips([{ key: "a>b", text: "A → B: Brief" }], [{ key: "a>b", text: "A → B: Full brief" }])).toEqual([
      { key: "removed:a>b", text: "A → B: Brief", kind: "removed" },
      { key: "added:a>b", text: "A → B: Full brief", kind: "added" },
    ]);
  });

  it("shows an item edited behind its label as one changed chip", () => {
    expect(diffChips([{ key: "triage", text: "Triage", detail: "old" }], [{ key: "triage", text: "Triage", detail: "new" }])).toEqual([
      { key: "changed:triage", text: "Triage", kind: "changed" },
    ]);
  });
});

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

  it("reports a kept item whose detail alone changed as changed", () => {
    expect(
      diffItemLists([{ key: "daily", text: "Daily", detail: "old prompt" }], [{ key: "daily", text: "Daily", detail: "new prompt" }])
    ).toEqual([{ type: "changed", key: "daily", original: "Daily", modified: "Daily" }]);
    expect(diffItemLists([{ key: "daily", text: "Daily", detail: "same" }], [{ key: "daily", text: "Daily", detail: "same" }])[0].type).toBe(
      "unchanged"
    );
  });

  it("handles empty lists", () => {
    expect(diffItemLists([], [])).toEqual([]);
    expect(diffItemLists([], textItems(["a"]))).toEqual([{ type: "added", key: "a", text: "a" }]);
    expect(diffItemLists(textItems(["a"]), [])).toEqual([{ type: "removed", key: "a", text: "a" }]);
  });
});
