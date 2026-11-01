import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { PromptWriter, PromptWriteResult } from "@/lib/prompt-write";
import {
  MAX_TEAM_MEMBERS,
  canEditTeam,
  canViewTeamBot,
  checkTeamInput,
  findInvalidTeamBots,
  loadTeamSnapshot,
  updateTeam,
  type BotTeamInput,
  type TeamViewer,
} from "./teams";
import {
  parseTeamSnapshot,
  redactTeamSnapshot,
  snapshotBotIds,
  snapshotToTeamInput,
  teamInputToSnapshot,
  teamSnapshotsEqual,
  type TeamSnapshot,
} from "./team-snapshot";

/**
 * Change requests and version history of bot teams, the team counterpart of prompt change
 * requests (src/app/api/prompts/[id]/changes) and prompt versions. Statuses reuse
 * ChangeRequestStatus: PENDING (open), APPROVED, REJECTED.
 */

export const TEAM_CHANGE_REASON_MAX_LENGTH = 2000;
export const TEAM_REVIEW_NOTE_MAX_LENGTH = 2000;

type ChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

function fail(status: number, error: string, message: string, extra: Record<string, unknown> = {}): PromptWriteResult<never> {
  return { ok: false, status, body: { error, message, ...extra } };
}

const userSummary = { select: { id: true, name: true, username: true, avatar: true } } as const;

/** Ids of the given bots that the viewer may see in a team */
export async function visibleTeamBotIds(botIds: string[], viewer: TeamViewer | null): Promise<Set<string>> {
  if (botIds.length === 0) return new Set();
  const bots = await db.prompt.findMany({
    where: { id: { in: botIds } },
    select: { id: true, type: true, isPrivate: true, isUnlisted: true, deletedAt: true, authorId: true },
  });
  return new Set(bots.filter((bot) => canViewTeamBot(bot, viewer)).map((bot) => bot.id));
}

/** The snapshots with members the viewer may not see left out */
async function redactForViewer<T extends TeamSnapshot[]>(snapshots: T, viewer: TeamViewer | null): Promise<T> {
  const visible = await visibleTeamBotIds([...new Set(snapshots.flatMap(snapshotBotIds))], viewer);
  return snapshots.map((snapshot) => redactTeamSnapshot(snapshot, visible)) as T;
}

/** Bot, category and tag names for a proposed team, so the stored proposal reads well later */
async function teamInputNames(input: BotTeamInput) {
  const [bots, category, tags] = await Promise.all([
    db.prompt.findMany({ where: { id: { in: input.members.map((m) => m.botId) } }, select: { id: true, title: true } }),
    input.categoryId ? db.category.findUnique({ where: { id: input.categoryId }, select: { id: true, name: true } }) : null,
    input.tagIds.length > 0 ? db.tag.findMany({ where: { id: { in: input.tagIds } }, select: { id: true, name: true } }) : [],
  ]);
  return {
    bots: new Map(bots.map((bot) => [bot.id, bot.title])),
    category,
    tags: new Map(tags.map((tag) => [tag.id, tag.name])),
  };
}

/**
 * The proposal with the members the proposer could not see (private or unlisted bots of the team)
 * kept as they are, with their handoffs, so approving it never drops bots the proposer never saw
 */
export function keepHiddenMembers(current: TeamSnapshot, visibleBotIds: ReadonlySet<string>, input: BotTeamInput): BotTeamInput {
  const hidden = current.members.filter((member) => !visibleBotIds.has(member.botId));
  if (hidden.length === 0) return input;
  const proposedIds = new Set(input.members.map((member) => member.botId));
  const added = hidden.filter((member) => !proposedIds.has(member.botId));
  const memberIds = new Set([...proposedIds, ...added.map((member) => member.botId)]);
  const hiddenIds = new Set(added.map((member) => member.botId));
  const hiddenLinks = current.links.filter(
    (link) =>
      (hiddenIds.has(link.fromBotId) || hiddenIds.has(link.toBotId)) && memberIds.has(link.fromBotId) && memberIds.has(link.toBotId)
  );
  return {
    ...input,
    members: [...input.members, ...added.map(({ botId, role, description }) => ({ botId, role, description }))],
    links: [...input.links, ...hiddenLinks],
  };
}

export interface TeamVersionItem {
  id: string;
  version: number;
  changeNote: string | null;
  createdAt: Date;
  author: { name: string | null; username: string } | null;
  snapshot: TeamSnapshot;
}

/** The team's versions, newest first, with members the viewer may not see left out */
export async function listTeamVersions(teamId: string, viewer: TeamViewer | null): Promise<TeamVersionItem[]> {
  const versions = await db.botTeamVersion.findMany({
    where: { teamId },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      changeNote: true,
      createdAt: true,
      snapshot: true,
      createdBy: { select: { name: true, username: true } },
    },
  });
  const snapshots = await redactForViewer(versions.map((version) => parseTeamSnapshot(version.snapshot)), viewer);
  return versions.map((version, index) => ({
    id: version.id,
    version: version.version,
    changeNote: version.changeNote,
    createdAt: version.createdAt,
    author: version.createdBy,
    snapshot: snapshots[index],
  }));
}

/** Change requests of the team, newest first, shaped for ChangeRequestList */
export async function listTeamChangeRequests(teamId: string) {
  const requests = await db.botTeamChangeRequest.findMany({
    where: { teamId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      reason: true,
      createdAt: true,
      originalSnapshot: true,
      proposedSnapshot: true,
      author: userSummary,
    },
  });
  return requests.map(({ originalSnapshot, proposedSnapshot, ...request }) => ({
    ...request,
    originalTitle: parseTeamSnapshot(originalSnapshot).title,
    proposedTitle: parseTeamSnapshot(proposedSnapshot).title,
  }));
}

export interface TeamChangeRequestDetail {
  id: string;
  teamId: string;
  status: ChangeStatus;
  reason: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  author: { id: string; name: string | null; username: string; avatar: string | null };
  reviewer: { id: string; name: string | null; username: string; avatar: string | null } | null;
  originalSnapshot: TeamSnapshot;
  proposedSnapshot: TeamSnapshot;
}

/** One change request of the team, with members the viewer may not see left out; null when not found */
export async function getTeamChangeRequest(
  teamId: string,
  changeId: string,
  viewer: TeamViewer | null
): Promise<TeamChangeRequestDetail | null> {
  const request = await db.botTeamChangeRequest.findUnique({
    where: { id: changeId },
    select: {
      id: true,
      teamId: true,
      status: true,
      reason: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      originalSnapshot: true,
      proposedSnapshot: true,
      author: userSummary,
      reviewer: userSummary,
    },
  });
  if (!request || request.teamId !== teamId) return null;
  const [originalSnapshot, proposedSnapshot] = await redactForViewer(
    [parseTeamSnapshot(request.originalSnapshot), parseTeamSnapshot(request.proposedSnapshot)],
    viewer
  );
  return { ...request, originalSnapshot, proposedSnapshot };
}

/** Number of open change requests on the user's teams, for the notification bell */
export function countPendingTeamChangeRequests(ownerId: string) {
  return db.botTeamChangeRequest.count({ where: { status: "PENDING", team: { authorId: ownerId } } });
}

interface TeamRef {
  id: string;
  authorId: string;
}

/**
 * Proposes the whole team as `input` (same body as PUT /api/bots/teams/[slug]). The proposer may
 * not own the team, and the proposal must change something and be one the owner could save.
 */
export async function createTeamChangeRequest(
  user: PromptWriter,
  team: TeamRef,
  input: BotTeamInput,
  reason: string | null
): Promise<PromptWriteResult<{ id: string }>> {
  if (team.authorId === user.id) {
    return fail(403, "forbidden", "You cannot create a change request for your own team");
  }
  const invalid = await checkTeamInput(user, input, team.id);
  if (invalid) return invalid;

  const current = await loadTeamSnapshot(team.id);
  if (!current) return fail(404, "not_found", "Team not found");

  const visible = await visibleTeamBotIds(current.members.map((member) => member.botId), user);
  const merged = keepHiddenMembers(current, visible, input);
  if (merged.members.length > MAX_TEAM_MEMBERS) {
    return fail(400, "validation_error", `A team can have up to ${MAX_TEAM_MEMBERS} bots`);
  }
  const unapprovable = await findInvalidTeamBots(merged.members.map((m) => m.botId), { id: team.authorId, role: "USER" }, team.id);
  if (unapprovable.length > 0) {
    return fail(400, "invalid_bots", "Some bots cannot be added to this team", { botIds: unapprovable });
  }

  const proposed = teamInputToSnapshot(merged, await teamInputNames(merged));
  if (teamSnapshotsEqual(current, proposed)) {
    return fail(400, "no_change", "The proposal does not change the team");
  }

  const request = await db.botTeamChangeRequest.create({
    data: {
      teamId: team.id,
      authorId: user.id,
      reason: reason || null,
      originalSnapshot: current as unknown as Prisma.InputJsonValue,
      proposedSnapshot: proposed as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  return { ok: true, data: request };
}

/**
 * Approves, rejects or reopens a change request; the team's owner and admins only. Approving
 * replaces the team with the proposal and saves it as a new version credited to the proposer.
 */
export async function reviewTeamChangeRequest(
  user: PromptWriter,
  team: TeamRef,
  changeId: string,
  status: ChangeStatus,
  reviewNote: string | null
): Promise<PromptWriteResult<{ status: ChangeStatus }>> {
  if (!canEditTeam(team, user)) {
    return fail(403, "forbidden", "Only the team owner can review change requests");
  }
  const request = await db.botTeamChangeRequest.findUnique({
    where: { id: changeId },
    select: { id: true, teamId: true, status: true, reason: true, authorId: true, proposedSnapshot: true, author: { select: { username: true } } },
  });
  if (!request || request.teamId !== team.id) return fail(404, "not_found", "Change request not found");

  if (request.status === "PENDING" && status === "PENDING") {
    return fail(400, "invalid_state", "Change request is already pending");
  }
  if (request.status === "APPROVED") {
    return fail(400, "invalid_state", "Cannot modify an approved change request");
  }
  if (request.status === "REJECTED" && status !== "PENDING") {
    return fail(400, "invalid_state", "Rejected requests can only be reopened");
  }

  if (status === "PENDING") {
    await db.botTeamChangeRequest.update({
      where: { id: changeId },
      data: { status, reviewNote: null, reviewerId: null, reviewedAt: null },
    });
    return { ok: true, data: { status } };
  }

  const decision = { status, reviewNote: reviewNote || null, reviewerId: user.id, reviewedAt: new Date() };
  if (status === "REJECTED") {
    await db.botTeamChangeRequest.update({ where: { id: changeId }, data: decision });
    return { ok: true, data: { status } };
  }

  const changeNote = request.reason
    ? `Contribution by @${request.author.username}: ${request.reason}`
    : `Contribution by @${request.author.username}`;
  const result = await updateTeam(user, team.id, snapshotToTeamInput(parseTeamSnapshot(request.proposedSnapshot)), {
    changeNote,
    versionAuthorId: request.authorId,
    afterWrite: (tx) => tx.botTeamChangeRequest.update({ where: { id: changeId }, data: decision }),
  });
  if (!result.ok) return result;
  return { ok: true, data: { status } };
}

/** Deletes the caller's own pending change request */
export async function dismissTeamChangeRequest(
  user: PromptWriter,
  team: TeamRef,
  changeId: string
): Promise<PromptWriteResult<{ success: true }>> {
  const request = await db.botTeamChangeRequest.findUnique({
    where: { id: changeId },
    select: { teamId: true, status: true, authorId: true },
  });
  if (!request || request.teamId !== team.id) return fail(404, "not_found", "Change request not found");
  if (request.authorId !== user.id) {
    return fail(403, "forbidden", "Only the author can dismiss their change request");
  }
  if (request.status !== "PENDING") {
    return fail(400, "invalid_state", "Only pending change requests can be dismissed");
  }
  await db.botTeamChangeRequest.delete({ where: { id: changeId } });
  return { ok: true, data: { success: true } };
}
