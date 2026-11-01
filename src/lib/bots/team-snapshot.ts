import type { DiffItem } from "@/lib/list-diff";
import type { BotTeamInput } from "./team-schema";

/**
 * A whole team at one point in time, stored as JSON in BotTeamVersion.snapshot and in
 * BotTeamChangeRequest.originalSnapshot/proposedSnapshot. Names of bots, the category and tags
 * are kept next to their ids so old versions stay readable after renames and deletions. The
 * backfill in prisma/migrations/20261101000000_bot_and_team_change_requests builds the same shape.
 */
export interface TeamSnapshot {
  title: string;
  description: string | null;
  category: { id: string; name: string } | null;
  tags: { id: string; name: string }[];
  members: TeamSnapshotMember[];
  links: TeamSnapshotLink[];
}

export interface TeamSnapshotMember {
  botId: string;
  title: string;
  role: string | null;
  description: string | null;
}

export interface TeamSnapshotLink {
  fromBotId: string;
  toBotId: string;
  label: string;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function named(value: unknown): { id: string; name: string } | null {
  if (!value || typeof value !== "object") return null;
  const { id, name } = value as Record<string, unknown>;
  return typeof id === "string" ? { id, name: typeof name === "string" ? name : id } : null;
}

/** A stored snapshot, tolerating missing or malformed parts */
export function parseTeamSnapshot(value: unknown): TeamSnapshot {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const list = (key: string) => (Array.isArray(raw[key]) ? (raw[key] as unknown[]) : []);
  return {
    title: typeof raw.title === "string" ? raw.title : "",
    description: str(raw.description),
    category: named(raw.category),
    tags: list("tags").map(named).filter((tag): tag is { id: string; name: string } => !!tag),
    members: list("members").flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const member = item as Record<string, unknown>;
      if (typeof member.botId !== "string") return [];
      return [{ botId: member.botId, title: str(member.title) ?? member.botId, role: str(member.role), description: str(member.description) }];
    }),
    links: list("links").flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const link = item as Record<string, unknown>;
      if (typeof link.fromBotId !== "string" || typeof link.toBotId !== "string") return [];
      return [{ fromBotId: link.fromBotId, toBotId: link.toBotId, label: typeof link.label === "string" ? link.label : "" }];
    }),
  };
}

/** The team write input that recreates a snapshot */
export function snapshotToTeamInput(snapshot: TeamSnapshot): BotTeamInput {
  return {
    title: snapshot.title,
    description: snapshot.description,
    categoryId: snapshot.category?.id ?? null,
    tagIds: snapshot.tags.map((tag) => tag.id),
    members: snapshot.members.map(({ botId, role, description }) => ({ botId, role, description })),
    links: snapshot.links.map(({ fromBotId, toBotId, label }) => ({ fromBotId, toBotId, label })),
  };
}

/** A snapshot of a team write input, with names looked up for display */
export function teamInputToSnapshot(
  input: BotTeamInput,
  names: { bots: Map<string, string>; category: { id: string; name: string } | null; tags: Map<string, string> }
): TeamSnapshot {
  return {
    title: input.title,
    description: input.description || null,
    category: input.categoryId ? (names.category ?? { id: input.categoryId, name: input.categoryId }) : null,
    tags: input.tagIds.map((id) => ({ id, name: names.tags.get(id) ?? id })).sort((a, b) => a.name.localeCompare(b.name)),
    members: input.members.map((member) => ({
      botId: member.botId,
      title: names.bots.get(member.botId) ?? member.botId,
      role: member.role || null,
      description: member.description || null,
    })),
    links: input.links.map(({ fromBotId, toBotId, label }) => ({ fromBotId, toBotId, label: label ?? "" })),
  };
}

/** Comparable content of a snapshot: names are display only, so renamed bots or tags are not changes */
function comparable(snapshot: TeamSnapshot) {
  return {
    title: snapshot.title,
    description: snapshot.description ?? "",
    category: snapshot.category?.id ?? null,
    tags: snapshot.tags.map((tag) => tag.id).sort(),
    members: snapshot.members.map((m) => [m.botId, m.role ?? "", m.description ?? ""]),
    links: snapshot.links.map((l) => [l.fromBotId, l.toBotId, l.label]),
  };
}

export function teamSnapshotsEqual(a: TeamSnapshot, b: TeamSnapshot): boolean {
  return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b));
}

/**
 * Keeps only members whose bot the viewer may see, and the handoffs between them, so private
 * and unlisted bots never show up in a diff or version of a team
 */
export function redactTeamSnapshot(snapshot: TeamSnapshot, visibleBotIds: ReadonlySet<string>): TeamSnapshot {
  return {
    ...snapshot,
    members: snapshot.members.filter((member) => visibleBotIds.has(member.botId)),
    links: snapshot.links.filter((link) => visibleBotIds.has(link.fromBotId) && visibleBotIds.has(link.toBotId)),
  };
}

/** Every bot id a snapshot mentions */
export function snapshotBotIds(snapshot: TeamSnapshot): string[] {
  return [...new Set([...snapshot.members.map((m) => m.botId), ...snapshot.links.flatMap((l) => [l.fromBotId, l.toBotId])])];
}

/** Keys of the text fields of a team, in display order; labels live in "changeRequests.teamFields" messages */
export const TEAM_TEXT_FIELDS = ["title", "description", "category", "tags", "handoffs"] as const;
export type TeamTextField = (typeof TEAM_TEXT_FIELDS)[number];

/** A team's top-level fields as plain text, for the same word diff as prompt content */
export function teamSnapshotTexts(snapshot: TeamSnapshot): Record<TeamTextField, string> {
  const titles = new Map(snapshot.members.map((member) => [member.botId, member.title]));
  return {
    title: snapshot.title,
    description: snapshot.description ?? "",
    category: snapshot.category?.name ?? "",
    tags: snapshot.tags.map((tag) => tag.name).join(", "),
    handoffs: snapshot.links
      .map((link) => `${titles.get(link.fromBotId) ?? link.fromBotId} → ${titles.get(link.toBotId) ?? link.toBotId}${link.label ? `: ${link.label}` : ""}`)
      .join("\n"),
  };
}

/** The list-like team fields, diffed item by item rather than as text */
export const TEAM_LIST_FIELDS = ["tags", "handoffs"] as const satisfies readonly TeamTextField[];
export type TeamListField = (typeof TEAM_LIST_FIELDS)[number];

/**
 * Tags (by id) and handoffs (by their two bots) as items, so a diff shows only the ones added or
 * removed; a handoff whose label changed shows as a change of that handoff
 */
export function teamSnapshotItems(snapshot: TeamSnapshot): Record<TeamListField, DiffItem[]> {
  const titles = new Map(snapshot.members.map((member) => [member.botId, member.title]));
  return {
    tags: snapshot.tags.map((tag) => ({ key: tag.id, text: tag.name })),
    handoffs: snapshot.links.map((link) => ({
      key: `${link.fromBotId}>${link.toBotId}`,
      text: `${titles.get(link.fromBotId) ?? link.fromBotId} → ${titles.get(link.toBotId) ?? link.toBotId}${link.label ? `: ${link.label}` : ""}`,
    })),
  };
}

export type TeamMemberChangeKind = "added" | "removed" | "changed" | "unchanged";

export interface TeamMemberChange {
  kind: TeamMemberChangeKind;
  botId: string;
  title: string;
  /** Role and description before and after; empty strings when unset or when the member is new or removed */
  role: { original: string; modified: string };
  description: { original: string; modified: string };
}

export interface TeamSnapshotDiff {
  /** Top-level text fields whose text differs */
  fields: { field: TeamTextField; original: string; modified: string }[];
  /** Every member of either side: kept members in the new order, then removed ones */
  members: TeamMemberChange[];
  /** Whether anything differs, including member order */
  hasChanges: boolean;
}

export function diffTeamSnapshots(original: TeamSnapshot, modified: TeamSnapshot): TeamSnapshotDiff {
  const originalTexts = teamSnapshotTexts(original);
  const modifiedTexts = teamSnapshotTexts(modified);
  const fields = TEAM_TEXT_FIELDS.filter((field) => originalTexts[field] !== modifiedTexts[field]).map((field) => ({
    field,
    original: originalTexts[field],
    modified: modifiedTexts[field],
  }));
  // Category, tag and bot ids decide changes; names alone (renamed since) do not
  const originalIds = comparable(original);
  const modifiedIds = comparable(modified);
  const sameIds: Record<"category" | "tags" | "handoffs", boolean> = {
    category: originalIds.category === modifiedIds.category,
    tags: JSON.stringify(originalIds.tags) === JSON.stringify(modifiedIds.tags),
    handoffs: JSON.stringify(originalIds.links) === JSON.stringify(modifiedIds.links),
  };
  const changedFields = fields.filter((f) => !(f.field in sameIds) || !sameIds[f.field as keyof typeof sameIds]);

  const before = new Map(original.members.map((member) => [member.botId, member]));
  const after = new Set(modified.members.map((member) => member.botId));
  const members: TeamMemberChange[] = [
    ...modified.members.map((member): TeamMemberChange => {
      const old = before.get(member.botId);
      const role = { original: old?.role ?? "", modified: member.role ?? "" };
      const description = { original: old?.description ?? "", modified: member.description ?? "" };
      const kind: TeamMemberChangeKind = !old
        ? "added"
        : role.original !== role.modified || description.original !== description.modified
          ? "changed"
          : "unchanged";
      return { kind, botId: member.botId, title: member.title, role, description };
    }),
    ...original.members
      .filter((member) => !after.has(member.botId))
      .map((member): TeamMemberChange => ({
        kind: "removed",
        botId: member.botId,
        title: member.title,
        role: { original: member.role ?? "", modified: "" },
        description: { original: member.description ?? "", modified: "" },
      })),
  ];

  return { fields: changedFields, members, hasChanges: !teamSnapshotsEqual(original, modified) };
}
