import { z } from "zod";

export const MAX_TEAM_MEMBERS = 12;
export const MIN_TEAM_MEMBERS = 2;
export const MAX_TEAM_LINKS = 40;
export const TEAM_TITLE_MAX_LENGTH = 120;
/** Team descriptions are markdown */
export const TEAM_DESCRIPTION_MAX_LENGTH = 4000;
export const TEAM_ROLE_MAX_LENGTH = 80;
export const TEAM_MEMBER_DESCRIPTION_MAX_LENGTH = 500;
export const TEAM_LINK_LABEL_MAX_LENGTH = 200;
export const MAX_TEAM_TAGS = 10;

export const botTeamMemberInputSchema = z.object({
  botId: z.string().trim().min(1),
  /** What the bot does in this team, e.g. "Researcher" */
  role: z.string().trim().max(TEAM_ROLE_MAX_LENGTH).nullish(),
  /** What this bot does in the team, in a sentence or two */
  description: z.string().trim().max(TEAM_MEMBER_DESCRIPTION_MAX_LENGTH).nullish(),
});

/** A directed handoff: fromBotId passes `label` (what is handed off) to toBotId */
export const botTeamLinkInputSchema = z.object({
  fromBotId: z.string().trim().min(1),
  toBotId: z.string().trim().min(1),
  label: z.string().trim().max(TEAM_LINK_LABEL_MAX_LENGTH).default(""),
});

export const botTeamMembersSchema = z
  .array(botTeamMemberInputSchema)
  .min(MIN_TEAM_MEMBERS)
  .max(MAX_TEAM_MEMBERS)
  .refine((members) => new Set(members.map((m) => m.botId)).size === members.length, {
    message: "Each bot can only be added to a team once",
  });

export const botTeamLinksSchema = z.array(botTeamLinkInputSchema).max(MAX_TEAM_LINKS);

/** Problems with a team's handoffs given its members, as messages; empty when valid */
export function teamLinkIssues(
  memberIds: readonly string[],
  links: readonly { fromBotId: string; toBotId: string }[]
): string[] {
  const members = new Set(memberIds);
  const seen = new Set<string>();
  const issues: string[] = [];
  for (const { fromBotId, toBotId } of links) {
    if (fromBotId === toBotId) issues.push("A bot cannot hand off to itself");
    else if (!members.has(fromBotId) || !members.has(toBotId)) issues.push("Handoffs can only connect bots of the team");
    else if (seen.has(`${fromBotId}>${toBotId}`)) issues.push("Each handoff can only be added once");
    seen.add(`${fromBotId}>${toBotId}`);
  }
  return [...new Set(issues)];
}

/** Body of POST /api/bots/teams and PUT /api/bots/teams/[slug] */
export const botTeamInputSchema = z
  .object({
    title: z.string().trim().min(1).max(TEAM_TITLE_MAX_LENGTH),
    description: z.string().trim().max(TEAM_DESCRIPTION_MAX_LENGTH).nullish(),
    categoryId: z.string().trim().nullish(),
    tagIds: z
      .array(z.string().trim().min(1))
      .max(MAX_TEAM_TAGS)
      .default([])
      .transform((ids) => [...new Set(ids)]),
    members: botTeamMembersSchema,
    links: botTeamLinksSchema.default([]),
  })
  .superRefine((team, ctx) => {
    for (const message of teamLinkIssues(team.members.map((m) => m.botId), team.links)) {
      ctx.addIssue({ code: "custom", path: ["links"], message });
    }
  });

export type BotTeamInput = z.output<typeof botTeamInputSchema>;
export type BotTeamMemberInput = z.output<typeof botTeamMemberInputSchema>;
export type BotTeamLinkInput = z.output<typeof botTeamLinkInputSchema>;

/** Markdown reduced to plain text, for excerpts and meta descriptions */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/(\*\*|\*|~~|`)(.+?)\1/g, "$2")
    // Underscores only mark emphasis at word edges, so snake_case names and URLs keep theirs
    .replace(/(^|[^\p{L}\p{N}_])(__|_)(?=\S)(.+?)(?<=\S)\2(?![\p{L}\p{N}_])/gu, "$1$3")
    .replace(/\s+/g, " ")
    .trim();
}
