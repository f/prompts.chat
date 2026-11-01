import { describe, it, expect } from "vitest";
import {
  botFieldsFromRecord,
  botSnapshotItems,
  botSnapshotTexts,
  changedBotTextFields,
  parseBotFields,
  parseVersionBotSnapshot,
  versionBotSnapshot,
  type BotFields,
} from "@/lib/bots/change-snapshot";
import {
  diffTeamSnapshots,
  parseTeamSnapshot,
  redactTeamSnapshot,
  snapshotToTeamInput,
  teamInputToSnapshot,
  teamSnapshotItems,
  teamSnapshotTexts,
  teamSnapshotsEqual,
  type TeamSnapshot,
} from "@/lib/bots/team-snapshot";
import { diffItemLists } from "@/lib/list-diff";

const fields: BotFields = {
  description: "Watches the build",
  platforms: ["OPENCLAW"],
  icon: null,
  color: null,
  computerRequirements: ["CLOUD"],
  installUrl: null,
  config: {
    routines: [{ name: "Nightly", type: "schedule", trigger: "0 2 * * *", triggerLabel: "Every night", prompt: "Check CI" }],
    skills: [{ name: "Triage", description: "Sorts failures", source: "" }],
    connectors: ["github"],
  },
};

describe("bot change snapshots", () => {
  it("reads bot fields from a prompt row", () => {
    const parsed = botFieldsFromRecord({
      description: "",
      botPlatform: null,
      botPlatforms: ["HERMES"],
      botIcon: "not-an-icon",
      botColor: null,
      computerRequirements: ["LOCAL", "CLOUD", "LOCAL"],
      installUrl: "",
      botConfig: "garbage",
    });
    expect(parsed).toEqual({
      description: null,
      platforms: ["HERMES"],
      icon: null,
      color: null,
      computerRequirements: ["CLOUD", "LOCAL"],
      installUrl: null,
      config: { routines: [], skills: [], connectors: [] },
    });
  });

  it("round-trips stored fields and rejects other JSON", () => {
    expect(parseBotFields(JSON.parse(JSON.stringify(fields)))).toEqual(fields);
    expect(parseBotFields(null)).toBeNull();
    expect(parseBotFields({ platforms: "nope" })).toBeNull();
  });

  it("stores the title with the fields in version snapshots", () => {
    const stored = versionBotSnapshot("CI bot", fields);
    expect(parseVersionBotSnapshot(stored)).toEqual({ title: "CI bot", fields });
    expect(parseVersionBotSnapshot(fields)).toBeNull();
    expect(parseVersionBotSnapshot(null)).toBeNull();
  });

  it("projects every bot field to text and finds the changed ones", () => {
    const original = botSnapshotTexts({ title: "CI bot", instructions: "Watch", fields });
    expect(original).toMatchObject({
      platforms: "OpenClaw",
      computers: "CLOUD",
      routines: "Nightly (schedule)\nSchedule: 0 2 * * * (Every night)\nCheck CI",
      skills: "Triage: Sorts failures",
      connectors: "github",
    });
    const modified = botSnapshotTexts({
      title: "CI bot",
      instructions: "Watch closely",
      fields: { ...fields, config: { ...fields.config, connectors: ["github", "slack"] } },
    });
    expect(changedBotTextFields(original, modified)).toEqual(["instructions", "connectors"]);
  });

  it("lists list-like bot fields as items matched by identity", () => {
    const items = botSnapshotItems(fields, (requirement) => requirement.toLowerCase())!;
    expect(items.platforms).toEqual([{ key: "OPENCLAW", text: "OpenClaw" }]);
    expect(items.computers).toEqual([{ key: "CLOUD", text: "cloud" }]);
    expect(items.connectors).toEqual([{ key: "github", text: "github" }]);
    expect(items.skills).toEqual([{ key: "Triage", text: "Triage", detail: "Triage: Sorts failures" }]);
    expect(items.routines).toEqual([
      { key: "Nightly", text: "Nightly · Every night", detail: "Nightly (schedule)\nSchedule: 0 2 * * * (Every night)\nCheck CI" },
    ]);
    expect(items.appearance).toEqual([]);
    expect(botSnapshotItems({ ...fields, icon: "bot", installUrl: "https://example.com" } as BotFields)!).toMatchObject({
      appearance: [{ key: "icon", text: "bot" }],
      installUrl: [{ key: "https://example.com", text: "https://example.com" }],
    });
    expect(botSnapshotItems(null)).toBeNull();

    const next = botSnapshotItems({ ...fields, platforms: ["OPENCLAW", "HERMES"], computerRequirements: ["CLOUD", "LOCAL"] })!;
    expect(diffItemLists(botSnapshotItems(fields)!.platforms, next.platforms).map((entry) => entry.type)).toEqual(["unchanged", "added"]);
    expect(diffItemLists(botSnapshotItems(fields)!.computers, next.computers).map((entry) => entry.type)).toEqual(["unchanged", "added"]);
  });

  it("compares only title and instructions when one side has no bot fields", () => {
    const legacy = botSnapshotTexts({ title: "CI bot", instructions: "Watch", fields: null });
    const current = botSnapshotTexts({ title: "CI bot", instructions: "Watch", fields });
    expect(changedBotTextFields(legacy, current)).toEqual([]);
  });
});

const base: TeamSnapshot = {
  title: "Research crew",
  description: "Finds and writes",
  category: { id: "cat-1", name: "Research" },
  tags: [{ id: "t-1", name: "agents" }],
  members: [
    { botId: "a", title: "Scout", role: "Researcher", description: "Finds sources" },
    { botId: "b", title: "Scribe", role: "Writer", description: null },
  ],
  links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
};

describe("team snapshots", () => {
  it("parses stored JSON tolerantly", () => {
    expect(parseTeamSnapshot(JSON.parse(JSON.stringify(base)))).toEqual(base);
    expect(parseTeamSnapshot(null)).toEqual({ title: "", description: null, category: null, tags: [], members: [], links: [] });
    expect(parseTeamSnapshot({ title: "x", members: [{ botId: "a" }, { nope: 1 }], links: [{ fromBotId: "a" }] })).toMatchObject({
      members: [{ botId: "a", title: "a", role: null, description: null }],
      links: [],
    });
  });

  it("converts to and from team input", () => {
    const input = snapshotToTeamInput(base);
    expect(input).toEqual({
      title: "Research crew",
      description: "Finds and writes",
      categoryId: "cat-1",
      tagIds: ["t-1"],
      members: [
        { botId: "a", role: "Researcher", description: "Finds sources" },
        { botId: "b", role: "Writer", description: null },
      ],
      links: [{ fromBotId: "a", toBotId: "b", label: "Brief" }],
    });
    const names = {
      bots: new Map([["a", "Scout"], ["b", "Scribe"]]),
      category: { id: "cat-1", name: "Research" },
      tags: new Map([["t-1", "agents"]]),
    };
    expect(teamInputToSnapshot(input, names)).toEqual(base);
  });

  it("ignores renamed bots and tags when comparing", () => {
    const renamed = {
      ...base,
      tags: [{ id: "t-1", name: "AI agents" }],
      members: base.members.map((member) => ({ ...member, title: member.title.toUpperCase() })),
    };
    expect(teamSnapshotsEqual(base, renamed)).toBe(true);
    expect(diffTeamSnapshots(base, renamed)).toMatchObject({ fields: [], hasChanges: false });
    expect(teamSnapshotsEqual(base, { ...base, description: "Other" })).toBe(false);
  });

  it("drops hidden members and their handoffs", () => {
    const redacted = redactTeamSnapshot(base, new Set(["a"]));
    expect(redacted.members.map((member) => member.botId)).toEqual(["a"]);
    expect(redacted.links).toEqual([]);
  });

  it("renders handoffs with bot titles", () => {
    expect(teamSnapshotTexts(base)).toMatchObject({ tags: "agents", category: "Research", handoffs: "Scout → Scribe: Brief" });
  });

  it("lists added, removed and changed members with field diffs", () => {
    const modified: TeamSnapshot = {
      ...base,
      title: "Research squad",
      members: [
        { botId: "a", title: "Scout", role: "Lead researcher", description: "Finds sources" },
        { botId: "c", title: "Critic", role: "Reviewer", description: "Checks facts" },
      ],
      links: [{ fromBotId: "a", toBotId: "c", label: "" }],
    };
    const diff = diffTeamSnapshots(base, modified);
    expect(diff.hasChanges).toBe(true);
    expect(diff.fields.map((field) => field.field)).toEqual(["title", "handoffs"]);
    expect(diff.fields[1]).toEqual({ field: "handoffs", original: "Scout → Scribe: Brief", modified: "Scout → Critic" });
    expect(diff.members).toEqual([
      {
        kind: "changed",
        botId: "a",
        title: "Scout",
        role: { original: "Researcher", modified: "Lead researcher" },
        description: { original: "Finds sources", modified: "Finds sources" },
      },
      {
        kind: "added",
        botId: "c",
        title: "Critic",
        role: { original: "", modified: "Reviewer" },
        description: { original: "", modified: "Checks facts" },
      },
      {
        kind: "removed",
        botId: "b",
        title: "Scribe",
        role: { original: "Writer", modified: "" },
        description: { original: "", modified: "" },
      },
    ]);
  });

  it("lists tags and handoffs as items so only added and removed ones differ", () => {
    const modified: TeamSnapshot = {
      ...base,
      tags: [...base.tags, { id: "t-2", name: "writing" }],
      links: [{ fromBotId: "a", toBotId: "b", label: "Full brief" }, { fromBotId: "b", toBotId: "a", label: "" }],
    };
    const before = teamSnapshotItems(base);
    const after = teamSnapshotItems(modified);
    expect(before.category).toEqual([{ key: "cat-1", text: "Research" }]);
    expect(diffItemLists(before.tags, after.tags)).toEqual([
      { type: "unchanged", key: "t-1", text: "agents" },
      { type: "added", key: "t-2", text: "writing" },
    ]);
    expect(diffItemLists(before.handoffs, after.handoffs)).toEqual([
      { type: "changed", key: "a>b", original: "Scout → Scribe: Brief", modified: "Scout → Scribe: Full brief" },
      { type: "added", key: "b>a", text: "Scribe → Scout" },
    ]);
  });

  it("counts a new member order as a change", () => {
    const reordered = { ...base, members: [...base.members].reverse() };
    const diff = diffTeamSnapshots(base, reordered);
    expect(diff.hasChanges).toBe(true);
    expect(diff.members.every((member) => member.kind === "unchanged")).toBe(true);
  });
});
