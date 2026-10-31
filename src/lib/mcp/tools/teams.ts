import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BOT_COMPUTER_REQUIREMENTS, BOT_PLATFORMS, extractBotId } from "@/lib/bots";
import {
  MAX_TEAM_LINKS,
  MAX_TEAM_MEMBERS,
  MAX_TEAM_TAGS,
  MIN_TEAM_MEMBERS,
  TEAM_DESCRIPTION_MAX_LENGTH,
  TEAM_LINK_LABEL_MAX_LENGTH,
  TEAM_MEMBER_DESCRIPTION_MAX_LENGTH,
  TEAM_ROLE_MAX_LENGTH,
  TEAM_TITLE_MAX_LENGTH,
  getTeam,
  getTeamInstallOptions,
  listTeams,
  teamLinkIssues,
  teamSummaryJson,
  teamToJson,
  upsertOwnTeam,
  type BotTeamView,
} from "@/lib/bots/teams";
import type { McpContext } from "../context";
import { TAG_NAMES_DESCRIPTION, cursorInput, decodeCursor, limitInput, nextCursor, taxonomyOutput, unknownTagsOutput } from "../schemas";
import { resolveCategoryId, resolveTagIds, resourceLink, unknownTagsWarning } from "../shared";
import { defineTool, toolResult, ToolError, unwrapWriteResult } from "../tool";

const teamMemberOutput = z.looseObject({
  id: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  computerRequirement: z.enum(BOT_COMPUTER_REQUIREMENTS),
});

const teamSummaryOutput = z.looseObject({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  author: z.string(),
  isFeatured: z.boolean(),
  category: taxonomyOutput.nullable(),
  tags: z.array(taxonomyOutput),
  members: z.array(teamMemberOutput),
  handoffCount: z.number(),
  link: z.string(),
});

const teamDetailOutput = z.looseObject({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  isFeatured: z.boolean(),
  author: z.looseObject({ username: z.string(), name: z.string().nullable() }),
  category: taxonomyOutput.nullable(),
  tags: z.array(taxonomyOutput),
  members: z.array(
    teamMemberOutput.extend({
      slug: z.string().nullable(),
      description: z.string().nullable(),
      platforms: z.array(z.string()),
      link: z.string(),
    })
  ),
  handoffs: z.array(
    z.looseObject({ from: z.string(), to: z.string(), fromName: z.string(), toName: z.string(), label: z.string() })
  ),
  platforms: z.array(z.looseObject({ platform: z.string(), name: z.string(), botCount: z.number() })),
  link: z.string(),
});

/** Member bots link to their prompts-chat://bots resources */
function memberLinks(team: BotTeamView<{ id: string; title: string }>) {
  return team.members.map(({ bot }) => resourceLink("bots", { id: bot.id, title: bot.title }));
}

export function registerTeamTools(server: McpServer, ctx: McpContext) {
  const viewer = ctx.user ? { id: ctx.user.id, role: ctx.user.role } : null;

  defineTool(
    server,
    ctx,
    {
      name: "list_teams",
      title: "List Bot Teams",
      description:
        "List bot teams on prompts.chat (/bots/teams): groups of bots that hand work off to each other, featured first, then newest. " +
        "Optionally filter by keywords matched against the team title, description and member bot names, by category and by tags. " +
        "Returns small summaries (a plain-text excerpt of the description, members with roles, handoff count); call get_team for the full markdown description, what each member does, the handoff flow and the install prompt.",
      kind: "read",
      inputSchema: {
        query: z.string().optional().describe("Keywords; separate alternatives with commas"),
        category: z.string().optional().describe("Category slug; a parent category also matches its subcategories"),
        tags: z.array(z.string()).max(MAX_TEAM_TAGS).optional().describe("Tag slugs; every tag must match"),
        limit: limitInput(10, 50, "teams"),
        cursor: cursorInput,
      },
      outputSchema: {
        total: z.number(),
        count: z.number(),
        teams: z.array(teamSummaryOutput),
        nextCursor: z.string().optional(),
      },
      failureMessage: "Failed to list teams",
    },
    async ({ query, category, tags, limit, cursor }) => {
      const offset = decodeCursor(cursor);
      const { teams, total } = await listTeams({
        q: query?.trim(),
        categorySlug: category?.trim() || undefined,
        tagSlugs: tags?.map((tag) => tag.trim()).filter(Boolean),
        skip: offset,
        take: limit,
        viewer,
      });
      return toolResult({
        total,
        count: teams.length,
        teams: teams.map((team) => teamSummaryJson(team, ctx.baseUrl)),
        nextCursor: nextCursor(offset, teams.length, limit, total),
      });
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "get_team",
      title: "Get Bot Team",
      description:
        "Get a bot team by slug or id: its markdown description, its members with roles and what each does in the team, the directed handoffs between them (what each bot passes to the next; one bot may hand off to many and back), and the platforms its bots run on. " +
        "Pass `platform` to also get one install prompt that sets up the members that run on that platform and wires up the handoffs between them; members that do not run there are listed in `install.skipped`. " +
        "Member bots link to their prompts-chat://bots resources; call get_bot for a member's full definition.",
      kind: "read",
      inputSchema: {
        slug: z.string().optional().describe("Team slug, as in /bots/teams/{slug}"),
        id: z.string().optional().describe("Team id, used when no slug is given"),
        platform: z.enum(BOT_PLATFORMS).optional().describe("Return the install prompt for this platform"),
      },
      outputSchema: {
        ...teamDetailOutput.shape,
        install: z
          .looseObject({ platform: z.string(), bots: z.array(z.string()), skipped: z.array(z.string()), installPrompt: z.string() })
          .optional(),
      },
      failureMessage: "Failed to get team",
    },
    async ({ slug, id, platform }) => {
      if (!slug && !id) throw new ToolError("validation_error", "Provide a slug or an id");
      const team = await getTeam(slug ? { slug } : { id }, viewer);
      if (!team) throw new ToolError("not_found", "Team not found");

      const option = platform ? getTeamInstallOptions(team, ctx.baseUrl).find((o) => o.platform === platform) : undefined;
      if (platform && !option) throw new ToolError("unsupported_platform", `No bot in this team runs on ${platform}`);

      return toolResult(
        {
          ...teamToJson(team, ctx.baseUrl),
          ...(option && {
            install: {
              platform: option.platform,
              bots: option.bots.map((bot) => bot.title),
              skipped: option.skipped,
              installPrompt: option.installPrompt,
            },
          }),
        },
        memberLinks(team)
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "save_team",
      title: "Save Bot Team",
      description:
        "Create or update one of your own bot teams on prompts.chat (/bots/teams). " +
        "Idempotent upsert: updates your team matching `id`, else `slug`, else `title` (case-insensitive), and creates a new team only when none matches; " +
        "calling it again with the same team changes nothing (action \"unchanged\"). " +
        `A team has ${MIN_TEAM_MEMBERS}-${MAX_TEAM_MEMBERS} member bots (ids from search_bots or list_my_bots; public bots or your own) and directed handoffs between members. ` +
        "Handoffs may be N-to-N, e.g. a coordinator bot that hands off to every member and gets results back. " +
        "On update, members replace the stored members; omitted handoffs keep the stored ones between bots that stay, and an omitted team or member description, category or tags keep the stored ones. " +
        "Returns the action, the changed fields and the saved team. Requires API key authentication.",
      kind: "write",
      requiresAuth: true,
      annotations: { idempotentHint: true },
      inputSchema: {
        id: z.string().optional().describe("Id of your existing team to update. Fails if it is not one of your teams."),
        slug: z.string().optional().describe("Slug of your existing team to update. Falls back to matching by title."),
        title: z.string().trim().min(1).max(TEAM_TITLE_MAX_LENGTH).describe("Team title"),
        description: z
          .string()
          .trim()
          .max(TEAM_DESCRIPTION_MAX_LENGTH)
          .nullable()
          .optional()
          .describe("What the team does and how it works, in markdown; null clears it"),
        category: z.string().nullable().optional().describe("Category slug; null removes the category"),
        tags: z.array(z.string()).max(MAX_TEAM_TAGS).optional().describe(`${TAG_NAMES_DESCRIPTION} Replaces all tags.`),
        members: z
          .array(
            z.object({
              bot: z.string().trim().min(1).describe("Bot id (or \"id_slug\" URL segment)"),
              role: z.string().trim().max(TEAM_ROLE_MAX_LENGTH).optional().describe("The bot's role in the team, e.g. \"Researcher\""),
              description: z
                .string()
                .trim()
                .max(TEAM_MEMBER_DESCRIPTION_MAX_LENGTH)
                .nullable()
                .optional()
                .describe("What this bot does in the team, in a sentence or two; null clears it"),
            })
          )
          .min(MIN_TEAM_MEMBERS)
          .max(MAX_TEAM_MEMBERS)
          .describe("Member bots in team order"),
        handoffs: z
          .array(
            z.object({
              from: z.string().trim().min(1).describe("Member bot id that hands off"),
              to: z.string().trim().min(1).describe("Member bot id that receives"),
              label: z.string().trim().max(TEAM_LINK_LABEL_MAX_LENGTH).default("").describe("What is handed off, e.g. \"Research brief\""),
            })
          )
          .max(MAX_TEAM_LINKS)
          .optional()
          .describe("Directed handoffs between members. Replaces all handoffs."),
      },
      outputSchema: {
        success: z.literal(true),
        action: z.enum(["created", "updated", "unchanged"]),
        changedFields: z.array(z.string()),
        team: teamDetailOutput,
        ...unknownTagsOutput,
      },
      failureMessage: "Failed to save team",
    },
    async ({ id, slug, title, description, category, tags, members, handoffs }, { user }) => {
      const memberInputs = members.map((member) => ({
        botId: extractBotId(member.bot),
        role: member.role || null,
        description: member.description === undefined ? undefined : member.description || null,
      }));
      if (new Set(memberInputs.map((m) => m.botId)).size !== memberInputs.length) {
        throw new ToolError("validation_error", "Each bot can only be added to a team once");
      }
      const links = handoffs?.map((handoff) => ({ fromBotId: extractBotId(handoff.from), toBotId: extractBotId(handoff.to), label: handoff.label }));
      const issues = links ? teamLinkIssues(memberInputs.map((m) => m.botId), links) : [];
      if (issues.length > 0) throw new ToolError("validation_error", issues[0]);

      const resolvedTags = tags === undefined ? undefined : await resolveTagIds(tags);
      const { action, team, changedFields } = unwrapWriteResult(
        await upsertOwnTeam(
          { id: user.id, role: user.role },
          {
            id,
            slug,
            title,
            description,
            categoryId: await resolveCategoryId(category),
            tagIds: resolvedTags?.ids,
            members: memberInputs,
            links,
          }
        )
      );
      return toolResult(
        { success: true, action, changedFields, team: teamToJson(team, ctx.baseUrl), ...unknownTagsWarning(resolvedTags?.unknownTags ?? []) },
        memberLinks(team)
      );
    }
  );
}
