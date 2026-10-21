import type { NextApiRequest, NextApiResponse } from "next";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  ElicitResultSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type PrimitiveSchemaDefinition,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { isValidApiKeyFormat } from "@/lib/api-key";
import { parseSkillFiles, serializeSkillFiles, sanitizeFilename, DEFAULT_SKILL_FILE } from "@/lib/skill-files";
import appConfig from "@/../prompts.config";
import {
  mcpGeneralLimiter,
  mcpToolCallLimiter,
  mcpWriteToolLimiter,
  mcpAiToolLimiter,
} from "@/lib/rate-limit";

interface AuthenticatedUser {
  id: string;
  username: string;
  mcpPromptsPublicByDefault: boolean;
}

// In-memory auth cache for warm function instances (5-min TTL)
const authCache = new Map<string, { user: AuthenticatedUser | null; expiry: number }>();
const AUTH_CACHE_TTL = 5 * 60 * 1000;

async function authenticateApiKey(apiKey: string | null): Promise<AuthenticatedUser | null> {
  if (!apiKey || !isValidApiKeyFormat(apiKey)) {
    return null;
  }

  const cached = authCache.get(apiKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.user;
  }

  const user = await db.user.findUnique({
    where: { apiKey },
    select: {
      id: true,
      username: true,
      mcpPromptsPublicByDefault: true,
    },
  });

  authCache.set(apiKey, { user, expiry: Date.now() + AUTH_CACHE_TTL });
  return user;
}

interface ExtractedVariable {
  name: string;
  defaultValue?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Get the prompt name/slug for MCP.
 * Priority: slug > slugify(title) > id
 */
function getPromptName(prompt: { id: string; slug?: string | null; title: string }): string {
  if (prompt.slug) return prompt.slug;
  const titleSlug = slugify(prompt.title);
  if (titleSlug) return titleSlug;
  return prompt.id;
}

function extractVariables(content: string): ExtractedVariable[] {
  // Format: ${variableName} or ${variableName:default}
  const regex = /\$\{([a-zA-Z_][a-zA-Z0-9_\s]*?)(?::([^}]*))?\}/g;
  const variables: ExtractedVariable[] = [];
  const seen = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim();
    if (!seen.has(name)) {
      seen.add(name);
      variables.push({
        name,
        defaultValue: match[2]?.trim(),
      });
    }
  }
  return variables;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

interface ServerOptions {
  categories?: string[];
  tags?: string[];
  users?: string[];
  authenticatedUser?: AuthenticatedUser | null;
}

function createServer(options: ServerOptions = {}) {
  const server = new McpServer(
    {
      name: "prompts-chat",
      version: "1.0.0",
    },
    {
      capabilities: {
        prompts: { listChanged: false },
        tools: { listChanged: false },
      },
    }
  );

  const { authenticatedUser } = options;

  // Build category/tag filter for prompts
  // If authenticated user is present and no specific users filter, include their private prompts
  const buildPromptFilter = (includeOwnPrivate: boolean = true): Record<string, unknown> => {
    const baseFilter: Record<string, unknown> = {
      isUnlisted: false,
      deletedAt: null,
    };

    // Handle visibility: public prompts OR authenticated user's own prompts
    if (authenticatedUser && includeOwnPrivate) {
      // If users filter includes the authenticated user (or no users filter), include their private prompts
      const usersFilter = options.users && options.users.length > 0 ? options.users : null;
      const includeAuthUserPrivate = !usersFilter || usersFilter.includes(authenticatedUser.username);
      
      if (includeAuthUserPrivate) {
        baseFilter.OR = [
          { isPrivate: false },
          { isPrivate: true, authorId: authenticatedUser.id },
        ];
      } else {
        baseFilter.isPrivate = false;
      }
    } else {
      baseFilter.isPrivate = false;
    }

    if (options.categories && options.categories.length > 0) {
      baseFilter.category = {
        slug: { in: options.categories },
      };
    }

    if (options.tags && options.tags.length > 0) {
      baseFilter.tags = {
        some: {
          tag: { slug: { in: options.tags } },
        },
      };
    }

    if (options.users && options.users.length > 0) {
      baseFilter.author = {
        username: { in: options.users },
      };
    }

    return baseFilter;
  };

  const promptFilter = buildPromptFilter();

  // Dynamic MCP Prompts - expose database prompts as MCP prompts
  server.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
    const cursor = request.params?.cursor;
    const page = cursor ? parseInt(cursor, 10) : 1;
    const perPage = 20;

    const prompts = await db.prompt.findMany({
      where: promptFilter,
      skip: (page - 1) * perPage,
      take: perPage + 1, // fetch one extra to check if there's more
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
      },
    });

    const hasMore = prompts.length > perPage;
    const results = hasMore ? prompts.slice(0, perPage) : prompts;

    return {
      prompts: results.map((p) => {
        return {
          name: getPromptName(p),
          title: p.title,
          description: p.description || undefined,
        };
      }),
      nextCursor: hasMore ? String(page + 1) : undefined,
    };
  });

  server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptSlug = request.params.name;
    const args = request.params.arguments || {};

    const promptSelect = { id: true, slug: true, title: true, description: true, content: true };

    // Try direct lookup by slug first
    let prompt = await db.prompt.findFirst({
      where: { ...promptFilter, slug: promptSlug },
      select: promptSelect,
    });
    // Fallback: lookup by id
    if (!prompt) {
      prompt = await db.prompt.findFirst({
        where: { ...promptFilter, id: promptSlug },
        select: promptSelect,
      });
    }
    // Fallback: lookup by title for prompts without stored slug
    // Uses indexed DB query instead of loading 500 rows into memory
    // TODO: Backfill slug column for all existing prompts so this fallback can be removed
    if (!prompt) {
      const titleGuess = promptSlug.replace(/-/g, " ");
      prompt = await db.prompt.findFirst({
        where: { ...promptFilter, slug: null, title: { contains: titleGuess, mode: "insensitive" } },
        select: promptSelect,
      });
    }

    if (!prompt) {
      throw new Error(`Prompt not found: ${promptSlug}`);
    }

    // Replace variables in content
    let filledContent = prompt.content;
    const variables = extractVariables(prompt.content);
    
    for (const variable of variables) {
      const value = args[variable.name] ?? variable.defaultValue ?? `\${${variable.name}}`;
      filledContent = filledContent.replace(
        new RegExp(`\\$\\{${variable.name}(?::[^}]*)?\\}`, "g"),
        String(value)
      );
    }

    return {
      description: prompt.description || prompt.title,
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: filledContent,
          },
        },
      ],
    };
  });

  server.registerTool(
    "search_prompts",
    {
      title: "Search Prompts",
      description:
        "Search for AI prompts by keyword. Returns matching prompts with title, description, content, author, category, and tags. Use this to discover prompts for various AI tasks like coding, writing, analysis, and more.",
      inputSchema: {
        query: z.string().describe("Search query to find relevant prompts"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum number of prompts to return (default 10, max 50)"),
        type: z
          .enum(["TEXT", "STRUCTURED", "IMAGE", "VIDEO", "AUDIO"])
          .optional()
          .describe("Filter by prompt type"),
        category: z.string().optional().describe("Filter by category slug"),
        tag: z.string().optional().describe("Filter by tag slug"),
      },
    },
    async ({ query, limit = 10, type, category, tag }) => {
      try {
        const where: Record<string, unknown> = {
          isUnlisted: false,
          deletedAt: null,
          AND: [
            // Search filter
            {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
                { content: { contains: query, mode: "insensitive" } },
              ],
            },
            // Visibility filter: public OR user's own private prompts
            authenticatedUser
              ? {
                  OR: [
                    { isPrivate: false },
                    { isPrivate: true, authorId: authenticatedUser.id },
                  ],
                }
              : { isPrivate: false },
          ],
        };

        if (type) where.type = type;
        if (category) where.category = { slug: category };
        if (tag) where.tags = { some: { tag: { slug: tag } } };

        const prompts = await db.prompt.findMany({
          where,
          take: Math.min(limit, 50),
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            content: true,
            type: true,
            createdAt: true,
            author: { select: { username: true, name: true } },
            category: { select: { name: true, slug: true } },
            tags: { select: { tag: { select: { name: true, slug: true } } } },
            _count: { select: { votes: true } },
          },
        });

        const results = prompts.map((p) => ({
          id: p.id,
          slug: getPromptName(p),
          title: p.title,
          description: p.description,
          contentPreview: p.content.substring(0, 300) + (p.content.length > 300 ? '...' : ''),
          type: p.type,
          author: p.author.name || p.author.username,
          category: p.category?.name || null,
          tags: p.tags.map((t) => t.tag.name),
          votes: p._count.votes,
          createdAt: p.createdAt.toISOString(),
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ query, count: results.length, prompts: results }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP search_prompts error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to search prompts" }) }],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    "get_prompt",
    {
      title: "Get Prompt",
      description:
        "Get a prompt by ID and optionally fill in its variables. If the prompt contains template variables (like {{variable}}), you will be asked to provide values for them.",
      inputSchema: {
        id: z.string().describe("The ID of the prompt to retrieve"),
        fill_variables: z.boolean().default(false).describe(
          "If true and the prompt has template variables, triggers interactive variable filling. Default false — returns raw prompt with variable metadata."
        ),
      },
    },
    async ({ id, fill_variables }, extra) => {
      try {
        const prompt = await db.prompt.findFirst({
          where: {
            id,
            isPrivate: false,
            isUnlisted: false,
            deletedAt: null,
          },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            content: true,
            type: true,
            structuredFormat: true,
            author: { select: { username: true, name: true } },
            category: { select: { name: true, slug: true } },
            tags: { select: { tag: { select: { name: true, slug: true } } } },
          },
        });

        if (!prompt) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Prompt not found" }) }],
            isError: true,
          };
        }

        const variables = extractVariables(prompt.content);

        if (fill_variables && variables.length > 0) {
          const properties: Record<string, PrimitiveSchemaDefinition> = {};
          const requiredFields: string[] = [];
          for (const variable of variables) {
            properties[variable.name] = {
              type: "string",
              title: variable.name,
              description: `Value for \${${variable.name}}${variable.defaultValue ? ` (default: ${variable.defaultValue})` : ""}`,
              default: variable.defaultValue,
            };
            // Only require fields without defaults
            if (!variable.defaultValue) {
              requiredFields.push(variable.name);
            }
          }

          try {
            // Add timeout to prevent hanging if client doesn't support elicitation
            const timeoutMs = 10000; // 10 seconds
            const elicitationPromise = extra.sendRequest(
              {
                method: "elicitation/create",
                params: {
                  mode: "form",
                  message: `This prompt requires ${variables.length} variable(s). Please provide values:`,
                  requestedSchema: {
                    type: "object",
                    properties,
                    required: requiredFields.length > 0 ? requiredFields : undefined,
                  },
                },
              },
              ElicitResultSchema
            );

            let timeoutId: NodeJS.Timeout;
            const timeoutPromise = new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error("Elicitation timeout")), timeoutMs);
            });

            try {
              const elicitResult = await Promise.race([elicitationPromise, timeoutPromise]);
              clearTimeout(timeoutId!);

              if (elicitResult.action === "accept" && elicitResult.content) {
                let filledContent = prompt.content;
                for (const [key, value] of Object.entries(elicitResult.content)) {
                  // Skip keys that don't match valid variable name format (ReDoS prevention)
                  if (!/^[a-zA-Z_][a-zA-Z0-9_\s]*$/.test(key)) {
                    continue;
                  }
                  // Replace ${key} or ${key:default} patterns
                  filledContent = filledContent.replace(
                    new RegExp(`\\$\\{${key}(?::[^}]*)?\\}`, "g"),
                    String(value)
                  );
                }

                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify({
                          ...prompt,
                          content: filledContent,
                          originalContent: prompt.content,
                          variables: elicitResult.content,
                          author: prompt.author.name || prompt.author.username,
                          category: prompt.category?.name || null,
                          tags: prompt.tags.map((t) => t.tag.name),
                          link: `https://prompts.chat/prompts/${prompt.id}_${getPromptName(prompt)}`,
                        }),
                    },
                  ],
                };
              } else {
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify({
                          ...prompt,
                          variablesRequired: variables,
                          message: "User declined to provide variable values. Returning original prompt.",
                          author: prompt.author.name || prompt.author.username,
                          category: prompt.category?.name || null,
                          tags: prompt.tags.map((t) => t.tag.name),
                          link: `https://prompts.chat/prompts/${prompt.id}_${getPromptName(prompt)}`,
                        }),
                    },
                  ],
                };
              }
            } catch (e) {
              clearTimeout(timeoutId!);
              throw e;
            }
          } catch {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                      ...prompt,
                      variablesRequired: variables,
                      message: "Elicitation not supported. Variables need to be filled manually.",
                      author: prompt.author.name || prompt.author.username,
                      category: prompt.category?.name || null,
                      tags: prompt.tags.map((t) => t.tag.name),
                      link: `https://prompts.chat/prompts/${prompt.id}_${getPromptName(prompt)}`,
                    }),
                },
              ],
            };
          }
        } else if (variables.length > 0) {
          // Return prompt with variable metadata, no timeout
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              id: prompt.id,
              slug: getPromptName(prompt),
              title: prompt.title,
              description: prompt.description,
              content: prompt.content,
              type: prompt.type,
              author: prompt.author.name || prompt.author.username,
              category: prompt.category?.name || null,
              tags: prompt.tags.map((t) => t.tag.name),
              variables: variables.map(v => ({ name: v.name, defaultValue: v.defaultValue })),
              hint: "This prompt has template variables. Call get_prompt with fill_variables=true to fill them interactively.",
            }) }],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                  ...prompt,
                  author: prompt.author.name || prompt.author.username,
                  category: prompt.category?.name || null,
                  tags: prompt.tags.map((t) => t.tag.name),
                  link: `https://prompts.chat/prompts/${prompt.id}_${getPromptName(prompt)}`,
                }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP get_prompt error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to get prompt" }) }],
          isError: true,
        };
      }
    }
  );

  // Save prompt tool - requires authentication
  server.registerTool(
    "save_prompt",
    {
      title: "Save Prompt",
      description:
        "Save a new prompt to your prompts.chat account. Requires API key authentication. Prompts are private by default unless configured otherwise in settings.",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Title of the prompt"),
        content: z.string().min(1).describe("The prompt content. Can include variables like ${variable} or ${variable:default}"),
        description: z.string().max(500).optional().describe("Optional description of the prompt"),
        tags: z.array(z.string()).max(10).optional().describe("Optional array of tag names (will be created if they don't exist)"),
        category: z.string().optional().describe("Optional category slug"),
        isPrivate: z.boolean().optional().describe("Whether the prompt is private (default: uses your account setting)"),
        type: z.enum(["TEXT", "STRUCTURED", "IMAGE", "VIDEO", "AUDIO"]).optional().describe("Prompt type (default: TEXT)"),
        structuredFormat: z.enum(["JSON", "YAML"]).optional().describe("Format for structured prompts"),
      },
    },
    async ({ title, content, description, tags, category, isPrivate, type, structuredFormat }) => {
      if (!authenticatedUser) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Authentication required. Please provide an API key." }) }],
          isError: true,
        };
      }

      try {
        // Determine privacy setting
        const shouldBePrivate = isPrivate !== undefined ? isPrivate : !authenticatedUser.mcpPromptsPublicByDefault;

        // Find or create tags
        const tagConnections: { tag: { connect: { id: string } } }[] = [];
        if (tags && tags.length > 0) {
          for (const tagName of tags) {
            const tagSlug = slugify(tagName);
            if (!tagSlug) continue;
            
            let tag = await db.tag.findUnique({ where: { slug: tagSlug } });
            if (!tag) {
              tag = await db.tag.create({
                data: {
                  name: tagName,
                  slug: tagSlug,
                },
              });
            }
            tagConnections.push({ tag: { connect: { id: tag.id } } });
          }
        }

        // Find category if provided
        let categoryId: string | undefined;
        if (category) {
          const cat = await db.category.findUnique({ where: { slug: category } });
          if (cat) categoryId = cat.id;
        }

        // Create the prompt
        const prompt = await db.prompt.create({
          data: {
            title,
            slug: slugify(title),
            content,
            description: description || null,
            isPrivate: shouldBePrivate,
            type: type || "TEXT",
            structuredFormat: type === "STRUCTURED" ? (structuredFormat || "JSON") : null,
            authorId: authenticatedUser.id,
            categoryId: categoryId || null,
            tags: {
              create: tagConnections,
            },
          },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            content: true,
            isPrivate: true,
            type: true,
            createdAt: true,
            tags: { select: { tag: { select: { name: true, slug: true } } } },
            category: { select: { name: true, slug: true } },
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                  success: true,
                  prompt: {
                    ...prompt,
                    tags: prompt.tags.map((t) => t.tag.name),
                    category: prompt.category?.name || null,
                    link: prompt.isPrivate ? null : `https://prompts.chat/prompts/${prompt.id}_${getPromptName(prompt)}`,
                  },
                }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP save_prompt error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to save prompt" }) }],
          isError: true,
        };
      }
    }
  );

  // Improve prompt tool - uses AI to enhance prompts
  server.registerTool(
    "improve_prompt",
    {
      title: "Improve Prompt",
      description:
        "Transform a basic prompt into a well-structured, comprehensive prompt using AI. Optionally searches for similar prompts for inspiration. Supports different output types (text, image, video, sound) and formats (text, JSON, YAML).",
      inputSchema: {
        prompt: z.string().min(1).max(10000).describe("The prompt to improve"),
        outputType: z
          .enum(["text", "image", "video", "sound"])
          .default("text")
          .describe("Content type: text, image, video, or sound"),
        outputFormat: z
          .enum(["text", "structured_json", "structured_yaml"])
          .default("text")
          .describe("Response format: text, structured_json, or structured_yaml"),
      },
    },
    async ({ prompt, outputType = "text", outputFormat = "text" }) => {
      if (!authenticatedUser) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Authentication required. Please provide an API key." }) }],
          isError: true,
        };
      }

      try {
        const { improvePrompt } = await import("@/lib/ai/improve-prompt");
        const result = await improvePrompt({ prompt, outputType, outputFormat });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result),
            },
          ],
        };
      } catch (error) {
        console.error("MCP improve_prompt error:", error);
        const message = error instanceof Error ? error.message : "Failed to improve prompt";
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    }
  );

  // Save skill tool - create a new skill with multiple files
  server.registerTool(
    "save_skill",
    {
      title: "Save Skill",
      description:
        "Save a new Agent Skill to your prompts.chat account. Skills are multi-file prompts that can include SKILL.md (required), reference docs, scripts, and configuration files. Requires API key authentication. If the file contents are too long, first save the SKILL.md only, with no other files. Then call add_file_to_skill tool per file.",
      inputSchema: {
        title: z.string().min(1).max(200).describe("Title of the skill"),
        description: z.string().max(500).optional().describe("Description of what the skill does"),
        files: z.array(z.object({
          filename: z.string().describe("File path (e.g., 'SKILL.md', 'reference.md', 'scripts/helper.py')"),
          content: z.string().describe("File content"),
        })).min(1).describe("Array of files. Must include SKILL.md as the main skill file."),
        tags: z.array(z.string()).max(10).optional().describe("Optional array of tag names"),
        category: z.string().optional().describe("Optional category slug"),
        isPrivate: z.boolean().optional().describe("Whether the skill is private (default: uses your account setting)"),
      },
    },
    async ({ title, description, files, tags, category, isPrivate }) => {
      if (!authenticatedUser) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Authentication required. Please provide an API key." }) }],
          isError: true,
        };
      }

      try {
        // Ensure SKILL.md exists
        const hasSkillMd = files.some(f => f.filename === DEFAULT_SKILL_FILE);
        if (!hasSkillMd) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "SKILL.md file is required" }) }],
            isError: true,
          };
        }

        // Validate all filenames to prevent path traversal
        for (const f of files) {
          if (f.filename !== DEFAULT_SKILL_FILE && !sanitizeFilename(f.filename)) {
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid filename: '${f.filename}'. Filenames must not contain '..', start/end with '/', or use special characters.` }) }],
              isError: true,
            };
          }
        }

        // Serialize files to multi-file format
        const content = serializeSkillFiles(files.map(f => ({ filename: f.filename, content: f.content })));

        // Determine privacy setting
        const shouldBePrivate = isPrivate !== undefined ? isPrivate : !authenticatedUser.mcpPromptsPublicByDefault;

        // Find or create tags
        const tagConnections: { tag: { connect: { id: string } } }[] = [];
        if (tags && tags.length > 0) {
          for (const tagName of tags) {
            const tagSlug = slugify(tagName);
            if (!tagSlug) continue;
            
            let tag = await db.tag.findUnique({ where: { slug: tagSlug } });
            if (!tag) {
              tag = await db.tag.create({
                data: { name: tagName, slug: tagSlug },
              });
            }
            tagConnections.push({ tag: { connect: { id: tag.id } } });
          }
        }

        // Find category if provided
        let categoryId: string | undefined;
        if (category) {
          const cat = await db.category.findUnique({ where: { slug: category } });
          if (cat) categoryId = cat.id;
        }

        // Create the skill
        const skill = await db.prompt.create({
          data: {
            title,
            slug: slugify(title),
            content,
            description: description || null,
            isPrivate: shouldBePrivate,
            type: "SKILL",
            authorId: authenticatedUser.id,
            categoryId: categoryId || null,
            tags: { create: tagConnections },
          },
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            isPrivate: true,
            createdAt: true,
            tags: { select: { tag: { select: { name: true, slug: true } } } },
            category: { select: { name: true, slug: true } },
          },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                  success: true,
                  skill: {
                    ...skill,
                    files: files.map(f => f.filename),
                    tags: skill.tags.map((t) => t.tag.name),
                    category: skill.category?.name || null,
                    link: skill.isPrivate ? null : `https://prompts.chat/prompts/${skill.id}_${getPromptName(skill)}`,
                  },
                }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP save_skill error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to save skill" }) }],
          isError: true,
        };
      }
    }
  );

  // Add file to skill tool
  server.registerTool(
    "add_file_to_skill",
    {
      title: "Add File to Skill",
      description:
        "Add a new file to an existing Agent Skill. Use this to add reference docs, scripts, or configuration files to a skill you own.",
      inputSchema: {
        skillId: z.string().describe("The ID of the skill to add the file to"),
        filename: z.string().describe("File path (e.g., 'reference.md', 'scripts/helper.py', 'config/settings.json')"),
        content: z.string().describe("File content"),
      },
    },
    async ({ skillId, filename, content }) => {
      if (!authenticatedUser) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Authentication required. Please provide an API key." }) }],
          isError: true,
        };
      }

      try {
        // Fetch the skill
        const skill = await db.prompt.findFirst({
          where: {
            id: skillId,
            type: "SKILL",
            authorId: authenticatedUser.id,
            deletedAt: null,
          },
          select: { id: true, content: true, title: true, slug: true },
        });

        if (!skill) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Skill not found or you don't have permission to edit it" }) }],
            isError: true,
          };
        }

        // Parse existing files
        const files = parseSkillFiles(skill.content);

        // Check if file already exists
        if (files.some(f => f.filename === filename)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `File '${filename}' already exists. Use a different filename or update the existing file.` }) }],
            isError: true,
          };
        }

        // Cannot add SKILL.md (it always exists)
        if (filename === DEFAULT_SKILL_FILE) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "SKILL.md already exists. Edit the skill directly to modify it." }) }],
            isError: true,
          };
        }

        // Validate filename to prevent path traversal
        if (!sanitizeFilename(filename)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid filename: '${filename}'. Filenames must not contain '..', start/end with '/', or use special characters.` }) }],
            isError: true,
          };
        }

        // Add the new file
        files.push({ filename, content });

        // Serialize and update
        const updatedContent = serializeSkillFiles(files);
        await db.prompt.update({
          where: { id: skillId },
          data: { content: updatedContent, updatedAt: new Date() },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                  success: true,
                  message: `File '${filename}' added to skill`,
                  skillId,
                  files: files.map(f => f.filename),
                  link: `https://prompts.chat/prompts/${skill.id}_${getPromptName(skill)}`,
                }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP add_file_to_skill error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to add file to skill" }) }],
          isError: true,
        };
      }
    }
  );

  // Update file in skill tool
  server.registerTool(
    "update_skill_file",
    {
      title: "Update Skill File",
      description:
        "Update an existing file in an Agent Skill. Use this to modify reference docs, scripts, configuration files, or SKILL.md content.",
      inputSchema: {
        skillId: z.string().describe("The ID of the skill containing the file"),
        filename: z.string().describe("File path to update (e.g., 'SKILL.md', 'reference.md', 'scripts/helper.py')"),
        content: z.string().describe("New file content"),
      },
    },
    async ({ skillId, filename, content }) => {
      if (!authenticatedUser) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Authentication required. Please provide an API key." }) }],
          isError: true,
        };
      }

      try {
        // Fetch the skill
        const skill = await db.prompt.findFirst({
          where: {
            id: skillId,
            type: "SKILL",
            authorId: authenticatedUser.id,
            deletedAt: null,
          },
          select: { id: true, content: true, title: true, slug: true },
        });

        if (!skill) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Skill not found or you don't have permission to edit it" }) }],
            isError: true,
          };
        }

        // Validate filename to prevent path traversal
        if (filename !== DEFAULT_SKILL_FILE && !sanitizeFilename(filename)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `Invalid filename: '${filename}'. Filenames must not contain '..', start/end with '/', or use special characters.` }) }],
            isError: true,
          };
        }

        // Parse existing files
        const files = parseSkillFiles(skill.content);

        // Find the file to update
        const fileIndex = files.findIndex(f => f.filename === filename);
        if (fileIndex === -1) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `File '${filename}' not found in skill. Use add_file_to_skill to add new files.` }) }],
            isError: true,
          };
        }

        // Update the file content
        files[fileIndex].content = content;

        // Serialize and update
        const updatedContent = serializeSkillFiles(files);
        await db.prompt.update({
          where: { id: skillId },
          data: { content: updatedContent, updatedAt: new Date() },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                  success: true,
                  message: `File '${filename}' updated in skill`,
                  skillId,
                  files: files.map(f => f.filename),
                  link: `https://prompts.chat/prompts/${skill.id}_${getPromptName(skill)}`,
                }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP update_skill_file error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to update file in skill" }) }],
          isError: true,
        };
      }
    }
  );

  // Remove file from skill tool
  server.registerTool(
    "remove_file_from_skill",
    {
      title: "Remove File from Skill",
      description:
        "Remove a file from an existing Agent Skill. Cannot remove SKILL.md as it is required.",
      inputSchema: {
        skillId: z.string().describe("The ID of the skill to remove the file from"),
        filename: z.string().describe("File path to remove (e.g., 'reference.md', 'scripts/helper.py')"),
      },
    },
    async ({ skillId, filename }) => {
      if (!authenticatedUser) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Authentication required. Please provide an API key." }) }],
          isError: true,
        };
      }

      try {
        // Cannot remove SKILL.md
        if (filename === DEFAULT_SKILL_FILE) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Cannot remove SKILL.md - it is required for all skills" }) }],
            isError: true,
          };
        }

        // Fetch the skill
        const skill = await db.prompt.findFirst({
          where: {
            id: skillId,
            type: "SKILL",
            authorId: authenticatedUser.id,
            deletedAt: null,
          },
          select: { id: true, content: true, title: true, slug: true },
        });

        if (!skill) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Skill not found or you don't have permission to edit it" }) }],
            isError: true,
          };
        }

        // Parse existing files
        const files = parseSkillFiles(skill.content);

        // Check if file exists
        if (!files.some(f => f.filename === filename)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `File '${filename}' not found in this skill` }) }],
            isError: true,
          };
        }

        // Remove the file
        const updatedFiles = files.filter(f => f.filename !== filename);

        // Serialize and update
        const updatedContent = serializeSkillFiles(updatedFiles);
        await db.prompt.update({
          where: { id: skillId },
          data: { content: updatedContent, updatedAt: new Date() },
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                  success: true,
                  message: `File '${filename}' removed from skill`,
                  skillId,
                  files: updatedFiles.map(f => f.filename),
                  link: `https://prompts.chat/prompts/${skill.id}_${getPromptName(skill)}`,
                }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP remove_file_from_skill error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to remove file from skill" }) }],
          isError: true,
        };
      }
    }
  );

  // Get skill tool - retrieve a skill with all its files
  server.registerTool(
    "get_skill",
    {
      title: "Get Skill",
      description:
        "Get an Agent Skill by ID, including all its files (SKILL.md, reference docs, scripts, etc.). Returns the skill metadata and file contents. Save to .claude/skills/{slug}/SKILL.md and .claude/skills/{slug}/[other files] structure if user asks to download.",
      inputSchema: {
        id: z.string().describe("The ID of the skill to retrieve"),
      },
    },
    async ({ id }) => {
      try {
        // Build visibility filter
        const visibilityFilter = authenticatedUser
          ? {
              OR: [
                { isPrivate: false },
                { isPrivate: true, authorId: authenticatedUser.id },
              ],
            }
          : { isPrivate: false };

        const skill = await db.prompt.findFirst({
          where: {
            id,
            type: "SKILL",
            isUnlisted: false,
            deletedAt: null,
            ...visibilityFilter,
          },
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

        if (!skill) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Skill not found" }) }],
            isError: true,
          };
        }

        // Parse files from content
        const files = parseSkillFiles(skill.content);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                  id: skill.id,
                  slug: getPromptName(skill),
                  title: skill.title,
                  description: skill.description,
                  author: skill.author.name || skill.author.username,
                  category: skill.category?.name || null,
                  tags: skill.tags.map((t) => t.tag.name),
                  votes: skill._count.votes,
                  isPrivate: skill.isPrivate,
                  createdAt: skill.createdAt.toISOString(),
                  updatedAt: skill.updatedAt.toISOString(),
                  files: files.map(f => ({
                    filename: f.filename,
                    content: f.content,
                  })),
                  link: skill.isPrivate ? null : `https://prompts.chat/prompts/${skill.id}_${getPromptName(skill)}`,
                }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP get_skill error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to get skill" }) }],
          isError: true,
        };
      }
    }
  );

  // Search skills tool - search for agent skills
  server.registerTool(
    "search_skills",
    {
      title: "Search Skills",
      description:
        "Search for Agent Skills by keyword. Returns matching skills with title, description, author, and file list. Use this to discover reusable AI agent capabilities for coding, analysis, automation, and more.",
      inputSchema: {
        query: z.string().describe("Search query to find relevant skills"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum number of skills to return (default 10, max 50)"),
        category: z.string().optional().describe("Filter by category slug"),
        tag: z.string().optional().describe("Filter by tag slug"),
      },
    },
    async ({ query, limit = 10, category, tag }) => {
      try {
        const where: Record<string, unknown> = {
          type: "SKILL",
          isUnlisted: false,
          deletedAt: null,
          AND: [
            // Search filter
            {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
                { content: { contains: query, mode: "insensitive" } },
              ],
            },
            // Visibility filter: public OR user's own private skills
            authenticatedUser
              ? {
                  OR: [
                    { isPrivate: false },
                    { isPrivate: true, authorId: authenticatedUser.id },
                  ],
                }
              : { isPrivate: false },
          ],
        };

        if (category) where.category = { slug: category };
        if (tag) where.tags = { some: { tag: { slug: tag } } };

        const skills = await db.prompt.findMany({
          where,
          take: Math.min(limit, 50),
          orderBy: { createdAt: "desc" },
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
            author: s.author.name || s.author.username,
            category: s.category?.name || null,
            tags: s.tags.map((t) => t.tag.name),
            votes: s._count.votes,
            fileNames: files.map(f => f.filename),
            fileCount: files.length,
            createdAt: s.createdAt.toISOString(),
            link: `https://prompts.chat/prompts/${s.id}_${getPromptName(s)}`,
          };
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ query, count: results.length, skills: results }),
            },
          ],
        };
      } catch (error) {
        console.error("MCP search_skills error:", error);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: "Failed to search skills" }) }],
          isError: true,
        };
      }
    }
  );

  return server;
}

class PayloadTooLargeError extends Error {
  constructor() {
    super("Body too large");
    this.name = "PayloadTooLargeError";
  }
}

class ClientDisconnectedError extends Error {
  constructor() {
    super("Client disconnected before the request body was received");
    this.name = "ClientDisconnectedError";
  }
}

async function parseBody(req: NextApiRequest): Promise<unknown> {
  const MAX_BODY_SIZE = 1024 * 1024; // 1MB
  return new Promise((resolve, reject) => {
    let body = "";
    let bytesReceived = 0;
    let settled = false;
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      action();
    };

    req.on("data", (chunk: Buffer | string) => {
      bytesReceived += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      body += chunk;
      if (bytesReceived > MAX_BODY_SIZE) {
        req.destroy();
        settle(() => reject(new PayloadTooLargeError()));
        return;
      }
    });
    req.on("end", () => {
      settle(() => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on("error", (err) => settle(() => reject(err)));
    // A client that disconnects mid-upload emits `close` without `end` or `error`.
    // Without this the promise never settles and the McpServer/transport it is
    // holding are retained for the lifetime of the process.
    req.on("close", () => settle(() => reject(new ClientDisconnectedError())));
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!appConfig.features.mcp) {
    return res.status(404).json({ error: "MCP is not enabled" });
  }

  // Per MCP Streamable HTTP spec, GET is for opening an SSE stream.
  // This server is stateless and doesn't push notifications, so return 405.
  // See: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#listening-for-messages-from-the-server
  if (req.method === "GET") {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed. This MCP server does not support SSE. Use POST for JSON-RPC requests.",
      },
      id: null,
    });
  }

  if (req.method === "DELETE") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  }

  // Parse query parameters for filtering
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const categoriesParam = url.searchParams.get("categories");
  const tagsParam = url.searchParams.get("tags");
  const usersParam = url.searchParams.get("users");

  // Extract API key from PROMPTS_API_KEY header or query parameter
  const apiKeyHeader = req.headers["prompts_api_key"] || req.headers["prompts-api-key"];
  const apiKeyParam = url.searchParams.get("api_key");
  const apiKey = (Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader) || apiKeyParam;

  // Authenticate user if API key is provided
  const authenticatedUser = await authenticateApiKey(apiKey);

  const serverOptions: ServerOptions = { authenticatedUser };
  if (categoriesParam) {
    serverOptions.categories = categoriesParam.split(",").map((c) => c.trim());
  }
  if (tagsParam) {
    serverOptions.tags = tagsParam.split(",").map((t) => t.trim());
  }
  if (usersParam) {
    serverOptions.users = usersParam.split(",").map((u) => u.trim());
  }

  const server = createServer(serverOptions);

  let toreDown = false;
  const teardown = (transport?: StreamableHTTPServerTransport) => {
    if (toreDown) return;
    toreDown = true;
    // Both are async; a failure to close must never reject into the request path.
    void Promise.resolve()
      .then(() => transport?.close())
      .catch(() => {});
    void Promise.resolve()
      .then(() => server.close())
      .catch(() => {});
  };

  let transport: StreamableHTTPServerTransport | undefined;

  try {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    // Registered BEFORE dispatch: previously this was attached after awaiting
    // handleRequest, by which point the response may already have closed, so the
    // listener never fired and every MCP request leaked an McpServer + transport.
    res.once("close", () => teardown(transport));

    await server.connect(transport);

    const body = await parseBody(req);

    // --- Rate limiting ---
    const rateLimitId = apiKey || req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

    const generalCheck = mcpGeneralLimiter.check(rateLimitId);
    if (!generalCheck.allowed) {
      return res.status(429).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: `Rate limit exceeded. Try again in ${generalCheck.retryAfterSeconds}s.` },
        id: null,
      });
    }

    // Apply stricter limits for tool calls based on tool name
    const WRITE_TOOLS = new Set(["save_prompt", "save_skill", "add_file_to_skill", "update_skill_file", "remove_file_from_skill"]);
    const AI_TOOLS = new Set(["improve_prompt"]);

    const rpcBody = body as { method?: string; params?: { name?: string } };
    if (rpcBody?.method === "tools/call") {
      const toolCallCheck = mcpToolCallLimiter.check(rateLimitId);
      if (!toolCallCheck.allowed) {
        return res.status(429).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: `Tool call rate limit exceeded. Try again in ${toolCallCheck.retryAfterSeconds}s.` },
          id: null,
        });
      }

      const toolName = rpcBody.params?.name;
      if (toolName && AI_TOOLS.has(toolName)) {
        const aiCheck = mcpAiToolLimiter.check(rateLimitId);
        if (!aiCheck.allowed) {
          return res.status(429).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: `AI tool rate limit exceeded (${toolName}). Try again in ${aiCheck.retryAfterSeconds}s.` },
            id: null,
          });
        }
      } else if (toolName && WRITE_TOOLS.has(toolName)) {
        const writeCheck = mcpWriteToolLimiter.check(rateLimitId);
        if (!writeCheck.allowed) {
          return res.status(429).json({
            jsonrpc: "2.0",
            error: { code: -32000, message: `Write tool rate limit exceeded (${toolName}). Try again in ${writeCheck.retryAfterSeconds}s.` },
            id: null,
          });
        }
      }
    }

    await transport.handleRequest(req, res, body);
  } catch (error) {
    if (error instanceof ClientDisconnectedError) {
      // Routine: the peer went away mid-upload. Nothing to log and nothing to
      // send — the `finally` below still releases the transport and server.
      return;
    }
    console.error("MCP error:", error);
    if (!res.headersSent) {
      if (error instanceof PayloadTooLargeError) {
        res.status(413).json({
          jsonrpc: "2.0",
          error: { code: -32600, message: "Payload too large. Maximum body size is 1MB." },
          id: null,
        });
      } else {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  } finally {
    // Backstop: covers the aborted/errored paths, the early `return`s above
    // (rate-limit 429s previously leaked unconditionally), and the case where
    // `close` fired before the listener was attached. Idempotent, and safe here
    // because handleRequest has already fully written the response.
    teardown(transport);
  }
}
