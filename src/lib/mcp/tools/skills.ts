import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ResourceLink } from "@modelcontextprotocol/sdk/types.js";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { createPrompt, updatePrompt } from "@/lib/prompt-write";
import { DEFAULT_SKILL_FILE, parseSkillFiles, sanitizeFilename, serializeSkillFiles, type SkillFile } from "@/lib/skill-files";
import type { McpContext, McpUser } from "../context";
import {
  categorySlugInput,
  cursorInput,
  decodeCursor,
  isPrivateInput,
  limitInput,
  nextCursor,
  skillSummaryOutput,
  tagNamesInput,
  unknownTagsOutput,
} from "../schemas";
import {
  authorName,
  directVisibility,
  getPromptName,
  listingVisibility,
  promptWebUrl,
  resolveCategoryId,
  resolveTagIds,
  resourceLink,
  skillFileUri,
  unknownTagsWarning,
} from "../shared";
import { defineTool, toolResult, ToolError, unwrapWriteResult } from "../tool";

const skillIdInput = (purpose: string) => z.string().describe(`The ID of the skill ${purpose}`);

const fileChangeOutput = {
  success: z.literal(true),
  message: z.string(),
  skillId: z.string(),
  files: z.array(z.string()),
  link: z.string(),
};

function invalidFilename(filename: string): ToolError {
  return new ToolError(
    "invalid_filename",
    `Invalid filename: '${filename}'. Filenames must not contain '..', start/end with '/', or use special characters.`
  );
}

function fileLinks(skill: { id: string }, files: SkillFile[]): ResourceLink[] {
  return files.map((file) => ({
    type: "resource_link",
    uri: skillFileUri(skill.id, file.filename),
    name: file.filename,
  }));
}

/** A skill the caller owns, for editing its files */
async function findOwnSkill(user: McpUser, skillId: string) {
  const skill = await db.prompt.findFirst({
    where: { id: skillId, type: "SKILL", authorId: user.id, deletedAt: null },
    select: { id: true, content: true, title: true, slug: true },
  });
  if (!skill) throw new ToolError("not_found", "Skill not found or you don't have permission to edit it");
  return skill;
}

/** Saves the files through the same update path as the website, so each change creates a version */
async function saveSkillFiles(
  ctx: McpContext,
  user: McpUser,
  skill: { id: string; title: string; slug: string | null },
  files: SkillFile[],
  message: string
) {
  unwrapWriteResult(await updatePrompt(user, skill.id, { content: serializeSkillFiles(files) }));
  return toolResult(
    {
      success: true,
      message,
      skillId: skill.id,
      files: files.map((f) => f.filename),
      link: promptWebUrl(ctx, skill),
    },
    [resourceLink("skills", skill)]
  );
}

export function registerSkillTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: "search_skills",
      title: "Search Skills",
      description:
        "Search for Agent Skills by keyword. Returns matching skills with title, description, author, and file list, plus a resource link per skill. Use this to discover reusable AI agent capabilities for coding, analysis, automation, and more.",
      kind: "read",
      inputSchema: {
        query: z.string().describe("Search query to find relevant skills"),
        limit: limitInput(10, 50, "skills"),
        cursor: cursorInput,
        category: categorySlugInput.describe("Filter by category slug"),
        tag: z.string().optional().describe("Filter by tag slug"),
      },
      outputSchema: {
        query: z.string(),
        count: z.number(),
        skills: z.array(skillSummaryOutput),
        nextCursor: z.string().optional(),
      },
      failureMessage: "Failed to search skills",
    },
    async ({ query, limit, cursor, category, tag }) => {
      const offset = decodeCursor(cursor);
      const where: Prisma.PromptWhereInput = {
        AND: [
          { type: "SKILL" },
          listingVisibility(ctx.user),
          {
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { content: { contains: query, mode: "insensitive" } },
            ],
          },
          ...(category ? [{ category: { slug: category } }] : []),
          ...(tag ? [{ tags: { some: { tag: { slug: tag } } } }] : []),
        ],
      };

      const skills = await db.prompt.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          content: true,
          createdAt: true,
          author: { select: { username: true, name: true } },
          category: { select: { name: true, slug: true } },
          tags: { select: { tag: { select: { name: true, slug: true } } } },
          _count: { select: { votes: true } },
        },
      });

      const results = skills.map((s) => {
        const files = parseSkillFiles(s.content);
        return {
          id: s.id,
          slug: getPromptName(s),
          title: s.title,
          description: s.description,
          author: authorName(s.author),
          category: s.category?.name || null,
          tags: s.tags.map((t) => t.tag.name),
          votes: s._count.votes,
          fileNames: files.map((f) => f.filename),
          fileCount: files.length,
          createdAt: s.createdAt.toISOString(),
          link: promptWebUrl(ctx, s),
        };
      });

      return toolResult(
        { query, count: results.length, skills: results, nextCursor: nextCursor(offset, results.length, limit) },
        skills.map((s) => resourceLink("skills", s))
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "get_skill",
      title: "Get Skill",
      description:
        "Get an Agent Skill by ID, including all its files (SKILL.md, reference docs, scripts, etc.). Returns the skill metadata and file contents, plus a resource link per file. Save to .claude/skills/{slug}/SKILL.md and .claude/skills/{slug}/[other files] structure if user asks to download.",
      kind: "read",
      inputSchema: {
        id: z.string().describe("The ID of the skill to retrieve"),
      },
      outputSchema: {
        id: z.string(),
        slug: z.string(),
        title: z.string(),
        description: z.string().nullable(),
        author: z.string(),
        category: z.string().nullable(),
        tags: z.array(z.string()),
        votes: z.number(),
        isPrivate: z.boolean(),
        createdAt: z.string(),
        updatedAt: z.string(),
        files: z.array(z.looseObject({ filename: z.string(), content: z.string() })),
        link: z.string().nullable(),
      },
      failureMessage: "Failed to get skill",
    },
    async ({ id }) => {
      const skill = await db.prompt.findFirst({
        where: { id, type: "SKILL", ...directVisibility(ctx.user) },
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          content: true,
          isPrivate: true,
          createdAt: true,
          updatedAt: true,
          author: { select: { username: true, name: true } },
          category: { select: { name: true, slug: true } },
          tags: { select: { tag: { select: { name: true, slug: true } } } },
          _count: { select: { votes: true } },
        },
      });
      if (!skill) throw new ToolError("not_found", "Skill not found");

      const files = parseSkillFiles(skill.content);
      return toolResult(
        {
          id: skill.id,
          slug: getPromptName(skill),
          title: skill.title,
          description: skill.description,
          author: authorName(skill.author),
          category: skill.category?.name || null,
          tags: skill.tags.map((t) => t.tag.name),
          votes: skill._count.votes,
          isPrivate: skill.isPrivate,
          createdAt: skill.createdAt.toISOString(),
          updatedAt: skill.updatedAt.toISOString(),
          files: files.map((f) => ({ filename: f.filename, content: f.content })),
          link: skill.isPrivate ? null : promptWebUrl(ctx, skill),
        },
        fileLinks(skill, files)
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "save_skill",
      title: "Save Skill",
      description:
        "Save a new Agent Skill to your prompts.chat account. Skills are multi-file prompts that can include SKILL.md (required), reference docs, scripts, and configuration files. Requires API key authentication. If the file contents are too long, first save the SKILL.md only, with no other files. Then call add_file_to_skill tool per file. Goes through the same validation, limits and duplicate checks as the website.",
      kind: "write",
      requiresAuth: true,
      inputSchema: {
        title: z.string().min(1).max(200).describe("Title of the skill"),
        description: z.string().max(500).optional().describe("Description of what the skill does"),
        files: z
          .array(
            z.object({
              filename: z.string().describe("File path (e.g., 'SKILL.md', 'reference.md', 'scripts/helper.py')"),
              content: z.string().describe("File content"),
            })
          )
          .min(1)
          .describe("Array of files. Must include SKILL.md as the main skill file."),
        tags: tagNamesInput,
        category: categorySlugInput,
        isPrivate: isPrivateInput,
      },
      outputSchema: {
        success: z.literal(true),
        skill: z.looseObject({
          id: z.string(),
          slug: z.string().nullable(),
          title: z.string(),
          isPrivate: z.boolean(),
          files: z.array(z.string()),
          tags: z.array(z.string()),
          category: z.string().nullable(),
          link: z.string().nullable(),
        }),
        ...unknownTagsOutput,
      },
      failureMessage: "Failed to save skill",
    },
    async ({ title, description, files, tags, category, isPrivate }, { user }) => {
      if (!files.some((f) => f.filename === DEFAULT_SKILL_FILE)) {
        throw new ToolError("validation_error", "SKILL.md file is required");
      }
      for (const f of files) {
        if (f.filename !== DEFAULT_SKILL_FILE && !sanitizeFilename(f.filename)) throw invalidFilename(f.filename);
      }

      const resolvedTags = await resolveTagIds(tags ?? []);
      const skill = unwrapWriteResult(
        await createPrompt(user, {
          title,
          description,
          content: serializeSkillFiles(files),
          type: "SKILL",
          categoryId: (await resolveCategoryId(category)) ?? undefined,
          tagIds: resolvedTags.ids,
          isPrivate: isPrivate ?? !user.mcpPromptsPublicByDefault,
        })
      );

      return toolResult(
        {
          success: true,
          skill: {
            id: skill.id,
            slug: skill.slug,
            title: skill.title,
            description: skill.description,
            isPrivate: skill.isPrivate,
            createdAt: skill.createdAt.toISOString(),
            files: files.map((f) => f.filename),
            tags: skill.tags.map((t) => t.tag.name),
            category: skill.category?.name || null,
            link: skill.isPrivate ? null : promptWebUrl(ctx, skill),
          },
          ...unknownTagsWarning(resolvedTags.unknownTags),
        },
        [resourceLink("skills", skill)]
      );
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "add_file_to_skill",
      title: "Add File to Skill",
      description:
        "Add a new file to an existing Agent Skill. Use this to add reference docs, scripts, or configuration files to a skill you own.",
      kind: "write",
      requiresAuth: true,
      inputSchema: {
        skillId: skillIdInput("to add the file to"),
        filename: z.string().describe("File path (e.g., 'reference.md', 'scripts/helper.py', 'config/settings.json')"),
        content: z.string().describe("File content"),
      },
      outputSchema: fileChangeOutput,
      failureMessage: "Failed to add file to skill",
    },
    async ({ skillId, filename, content }, { user }) => {
      const skill = await findOwnSkill(user, skillId);
      const files = parseSkillFiles(skill.content);

      if (files.some((f) => f.filename === filename)) {
        throw new ToolError(
          "file_exists",
          `File '${filename}' already exists. Use a different filename or update the existing file.`
        );
      }
      if (filename === DEFAULT_SKILL_FILE) {
        throw new ToolError("file_exists", "SKILL.md already exists. Edit the skill directly to modify it.");
      }
      if (!sanitizeFilename(filename)) throw invalidFilename(filename);

      files.push({ filename, content });
      return saveSkillFiles(ctx, user, skill, files, `File '${filename}' added to skill`);
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "update_skill_file",
      title: "Update Skill File",
      description:
        "Update an existing file in an Agent Skill. Use this to modify reference docs, scripts, configuration files, or SKILL.md content.",
      kind: "write",
      requiresAuth: true,
      inputSchema: {
        skillId: skillIdInput("containing the file"),
        filename: z.string().describe("File path to update (e.g., 'SKILL.md', 'reference.md', 'scripts/helper.py')"),
        content: z.string().describe("New file content"),
      },
      outputSchema: fileChangeOutput,
      annotations: { idempotentHint: true },
      failureMessage: "Failed to update file in skill",
    },
    async ({ skillId, filename, content }, { user }) => {
      const skill = await findOwnSkill(user, skillId);
      if (filename !== DEFAULT_SKILL_FILE && !sanitizeFilename(filename)) throw invalidFilename(filename);

      const files = parseSkillFiles(skill.content);
      const file = files.find((f) => f.filename === filename);
      if (!file) {
        throw new ToolError("not_found", `File '${filename}' not found in skill. Use add_file_to_skill to add new files.`);
      }

      file.content = content;
      return saveSkillFiles(ctx, user, skill, files, `File '${filename}' updated in skill`);
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "remove_file_from_skill",
      title: "Remove File from Skill",
      description: "Remove a file from an existing Agent Skill. Cannot remove SKILL.md as it is required.",
      kind: "write",
      requiresAuth: true,
      inputSchema: {
        skillId: skillIdInput("to remove the file from"),
        filename: z.string().describe("File path to remove (e.g., 'reference.md', 'scripts/helper.py')"),
      },
      outputSchema: fileChangeOutput,
      annotations: { destructiveHint: true, idempotentHint: true },
      failureMessage: "Failed to remove file from skill",
    },
    async ({ skillId, filename }, { user }) => {
      if (filename === DEFAULT_SKILL_FILE) {
        throw new ToolError("validation_error", "Cannot remove SKILL.md - it is required for all skills");
      }
      const skill = await findOwnSkill(user, skillId);
      const files = parseSkillFiles(skill.content);
      if (!files.some((f) => f.filename === filename)) {
        throw new ToolError("not_found", `File '${filename}' not found in this skill`);
      }

      return saveSkillFiles(
        ctx,
        user,
        skill,
        files.filter((f) => f.filename !== filename),
        `File '${filename}' removed from skill`
      );
    }
  );
}
