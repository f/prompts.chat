import { db } from "@/lib/db";
import { semanticSearch, isAISearchEnabled } from "@/lib/ai/embeddings";

export interface PromptBuilderState {
  title: string;
  description: string;
  content: string;
  type: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STRUCTURED" | "TASTE";
  structuredFormat?: "JSON" | "YAML";
  categoryId?: string;
  tagIds: string[];
  isPrivate: boolean;
  requiresMediaUpload: boolean;
  requiredMediaType?: "IMAGE" | "VIDEO" | "DOCUMENT";
  requiredMediaCount?: number;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export const PROMPT_BUILDER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_prompts",
      description: "Search for existing prompts to use as examples or inspiration. Returns prompts matching the query with their title, description, content preview, and tags. Use promptType filter when looking for structured prompts like JSON or YAML.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query to find relevant prompts"
          },
          limit: {
            type: "number",
            description: "Maximum number of prompts to return (default 5, max 10)"
          },
          promptType: {
            type: "string",
            enum: ["TEXT", "STRUCTURED", "IMAGE", "VIDEO", "AUDIO"],
            description: "Filter by prompt type. Use STRUCTURED to find JSON/YAML format prompts."
          },
          structuredFormat: {
            type: "string",
            enum: ["JSON", "YAML"],
            description: "When promptType is STRUCTURED, filter by specific format (JSON or YAML)"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_title",
      description: "Set the prompt title. The title should be concise and descriptive.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The title for the prompt (max 200 characters)"
          }
        },
        required: ["title"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_description",
      description: "Set the prompt description. Should briefly explain what the prompt does.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "The description for the prompt (max 500 characters)"
          }
        },
        required: ["description"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_content",
      description: "Set the main prompt content. Use ${variableName} or ${variableName:defaultValue} syntax for variables that users can customize.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "The prompt content with optional variable placeholders"
          }
        },
        required: ["content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_type",
      description: "Set the prompt type (TEXT for regular prompts, STRUCTURED for JSON/YAML workflows, IMAGE/VIDEO/AUDIO for media generation prompts).",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["TEXT", "IMAGE", "VIDEO", "AUDIO", "STRUCTURED"],
            description: "The type of prompt"
          },
          structuredFormat: {
            type: "string",
            enum: ["JSON", "YAML"],
            description: "Format for structured prompts (only when type is STRUCTURED)"
          }
        },
        required: ["type"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_tags",
      description: "Set the tags for the prompt. Tags help users discover the prompt.",
      parameters: {
        type: "object",
        properties: {
          tagNames: {
            type: "array",
            items: { type: "string" },
            description: "Array of tag names to apply to the prompt"
          }
        },
        required: ["tagNames"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_category",
      description: "Set the category for the prompt to organize it.",
      parameters: {
        type: "object",
        properties: {
          categoryName: {
            type: "string",
            description: "The name of the category"
          }
        },
        required: ["categoryName"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_privacy",
      description: "Set whether the prompt is private (only visible to the author) or public.",
      parameters: {
        type: "object",
        properties: {
          isPrivate: {
            type: "boolean",
            description: "True for private, false for public"
          }
        },
        required: ["isPrivate"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "set_media_requirements",
      description: "Configure if the prompt requires users to upload media files when using it.",
      parameters: {
        type: "object",
        properties: {
          requiresMediaUpload: {
            type: "boolean",
            description: "Whether media upload is required"
          },
          mediaType: {
            type: "string",
            enum: ["IMAGE", "VIDEO", "DOCUMENT"],
            description: "Type of media required"
          },
          mediaCount: {
            type: "number",
            description: "Number of media files required (1-10)"
          }
        },
        required: ["requiresMediaUpload"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_available_tags",
      description: "Get all available tags that can be applied to prompts.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_available_categories",
      description: "Get all available categories for organizing prompts.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "get_current_state",
      description: "Get the current state of the prompt being built.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

/**
 * Execute one prompt-builder tool and return its result with the updated prompt state.
 * @param toolName Name of the tool requested by the model.
 * @param args Parsed arguments supplied for the tool call.
 * @param currentState Prompt state before the tool runs.
 * @param availableTags Tags that can be selected by the tool.
 * @param availableCategories Categories that can be selected by the tool.
 * @param signal Optional request cancellation signal, propagated to search operations.
 * @returns The tool result and resulting prompt state.
 * @throws If the request is aborted during prompt search.
 */
export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  currentState: PromptBuilderState,
  availableTags: Array<{ id: string; name: string; slug: string; color: string }>,
  availableCategories: Array<{ id: string; name: string; slug: string; parentId: string | null }>,
  signal?: AbortSignal
): Promise<{ result: ToolResult; newState: PromptBuilderState }> {
  const newState = { ...currentState };

  switch (toolName) {
    case "search_prompts": {
      const query = args.query as string;
      const limit = Math.min(Math.max((args.limit as number) || 5, 1), 10);
      const promptType = args.promptType as string | undefined;
      const structuredFormat = args.structuredFormat as string | undefined;
      
      try {
        signal?.throwIfAborted();
        // Run both full-text and semantic search in parallel
        const useSemanticSearch = await isAISearchEnabled();
        signal?.throwIfAborted();
        
        // Full-text search
        const textSearchPromise = db.prompt.findMany({
          where: {
            isPrivate: false,
            deletedAt: null,
            ...(promptType && { type: promptType as "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STRUCTURED" }),
            ...(structuredFormat && { structuredFormat: structuredFormat as "JSON" | "YAML" }),
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
              { content: { contains: query, mode: "insensitive" } }
            ]
          },
          select: {
            id: true,
            title: true,
            description: true,
            content: true,
            type: true,
            structuredFormat: true,
            tags: {
              select: {
                tag: {
                  select: { name: true, color: true }
                }
              }
            }
          },
          take: limit,
          orderBy: { createdAt: "desc" }
        });

        // Semantic search (if enabled)
        const semanticSearchPromise = useSemanticSearch 
          ? semanticSearch(query, limit, { signal })
          : Promise.resolve([]);

        const [textResults, semanticResults] = await Promise.all([
          textSearchPromise,
          semanticSearchPromise
        ]);
        signal?.throwIfAborted();

        // Combine and deduplicate results
        const seenIds = new Set<string>();
        const combinedResults: Array<{
          id: string;
          title: string;
          description: string | null;
          contentPreview: string;
          type: string;
          structuredFormat: string | null;
          tags: string[];
          source: "text" | "semantic" | "random";
          similarity?: string;
        }> = [];

        // Add semantic results first (higher relevance)
        for (const p of semanticResults) {
          if (seenIds.has(p.id)) continue;
          if (promptType && p.type !== promptType) continue;
          if (structuredFormat && p.structuredFormat !== structuredFormat) continue;
          
          seenIds.add(p.id);
          combinedResults.push({
            id: p.id,
            title: p.title,
            description: p.description,
            contentPreview: p.content.substring(0, 200) + (p.content.length > 200 ? "..." : ""),
            type: p.type,
            structuredFormat: p.structuredFormat,
            tags: p.tags.map(t => t.tag.name),
            source: "semantic",
            similarity: Math.round(p.similarity * 100) + "%"
          });
        }

        // Add text search results
        for (const p of textResults) {
          if (seenIds.has(p.id)) continue;
          
          seenIds.add(p.id);
          combinedResults.push({
            id: p.id,
            title: p.title,
            description: p.description,
            contentPreview: p.content.substring(0, 200) + (p.content.length > 200 ? "..." : ""),
            type: p.type,
            structuredFormat: p.structuredFormat,
            tags: p.tags.map((t: { tag: { name: string } }) => t.tag.name),
            source: "text"
          });
        }

        // Limit final results
        let finalResults = combinedResults.slice(0, limit);

        // If no results found, get random prompts to learn the style
        if (finalResults.length === 0) {
          signal?.throwIfAborted();
          const randomPrompts = await db.prompt.findMany({
            where: {
              isPrivate: false,
              deletedAt: null,
            },
            select: {
              id: true,
              title: true,
              description: true,
              content: true,
              type: true,
              structuredFormat: true,
              tags: {
                select: {
                  tag: {
                    select: { name: true, color: true }
                  }
                }
              }
            },
            take: limit,
            orderBy: { createdAt: "desc" }
          });

          finalResults = randomPrompts.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            contentPreview: p.content.substring(0, 200) + (p.content.length > 200 ? "..." : ""),
            type: p.type,
            structuredFormat: p.structuredFormat,
            tags: p.tags.map((t: { tag: { name: string } }) => t.tag.name),
            source: "random" as const
          }));
        }

        return {
          result: {
            success: true,
            data: {
              prompts: finalResults,
              count: finalResults.length,
              searchType: finalResults.length > 0 && finalResults[0].source === "random" 
                ? "random_examples" 
                : (useSemanticSearch ? "hybrid" : "text"),
              filters: { promptType, structuredFormat },
              note: finalResults.length > 0 && finalResults[0].source === "random"
                ? "No matching prompts found. Showing random examples to understand the prompt style."
                : undefined
            }
          },
          newState
        };
      } catch (error) {
        if (signal?.aborted) throw error;
        return {
          result: { success: false, error: "Failed to search prompts" },
          newState
        };
      }
    }

    case "set_title": {
      const title = (args.title as string).substring(0, 200);
      newState.title = title;
      return {
        result: { success: true, data: { title } },
        newState
      };
    }

    case "set_description": {
      const description = (args.description as string).substring(0, 500);
      newState.description = description;
      return {
        result: { success: true, data: { description } },
        newState
      };
    }

    case "set_content": {
      newState.content = args.content as string;
      return {
        result: { success: true, data: { content: newState.content } },
        newState
      };
    }

    case "set_type": {
      const type = args.type as PromptBuilderState["type"];
      newState.type = type;
      if (type === "STRUCTURED" && args.structuredFormat) {
        newState.structuredFormat = args.structuredFormat as "JSON" | "YAML";
      }
      return {
        result: { success: true, data: { type, structuredFormat: newState.structuredFormat } },
        newState
      };
    }

    case "set_tags": {
      const tagNames = args.tagNames as string[];
      const matchedTagIds: string[] = [];
      const matchedNames: string[] = [];

      for (const name of tagNames) {
        const tag = availableTags.find(
          t => t.name.toLowerCase() === name.toLowerCase() || t.slug === name.toLowerCase()
        );
        if (tag) {
          matchedTagIds.push(tag.id);
          matchedNames.push(tag.name);
        }
      }

      // A nonempty list with no matches is likely an invalid suggestion, not a
      // request to clear the existing selection. An explicit empty list clears it.
      newState.tagIds = tagNames.length > 0 && matchedTagIds.length === 0
        ? currentState.tagIds
        : matchedTagIds;
      return {
        result: {
          success: true,
          data: { 
            appliedTags: matchedNames,
            notFound: tagNames.filter(n => !matchedNames.map(m => m.toLowerCase()).includes(n.toLowerCase()))
          }
        },
        newState
      };
    }

    case "set_category": {
      const categoryName = args.categoryName as string;
      const category = availableCategories.find(
        c => c.name.toLowerCase() === categoryName.toLowerCase() || c.slug === categoryName.toLowerCase()
      );

      if (category) {
        newState.categoryId = category.id;
        return {
          result: { success: true, data: { category: category.name } },
          newState
        };
      }
      return {
        result: { success: false, error: `Category "${categoryName}" not found` },
        newState
      };
    }

    case "set_privacy": {
      newState.isPrivate = args.isPrivate as boolean;
      return {
        result: { success: true, data: { isPrivate: newState.isPrivate } },
        newState
      };
    }

    case "set_media_requirements": {
      newState.requiresMediaUpload = args.requiresMediaUpload as boolean;
      if (newState.requiresMediaUpload) {
        if (args.mediaType) {
          newState.requiredMediaType = args.mediaType as "IMAGE" | "VIDEO" | "DOCUMENT";
        }
        if (args.mediaCount) {
          newState.requiredMediaCount = Math.min(Math.max(args.mediaCount as number, 1), 10);
        }
      }
      return {
        result: {
          success: true,
          data: {
            requiresMediaUpload: newState.requiresMediaUpload,
            mediaType: newState.requiredMediaType,
            mediaCount: newState.requiredMediaCount
          }
        },
        newState
      };
    }

    case "get_available_tags": {
      return {
        result: {
          success: true,
          data: { tags: availableTags.map(t => ({ name: t.name, color: t.color })) }
        },
        newState
      };
    }

    case "get_available_categories": {
      return {
        result: {
          success: true,
          data: {
            categories: availableCategories.map(c => ({
              name: c.name,
              isSubcategory: !!c.parentId
            }))
          }
        },
        newState
      };
    }

    case "get_current_state": {
      const tagNames = currentState.tagIds
        .map(id => availableTags.find(t => t.id === id)?.name)
        .filter(Boolean);
      const categoryName = availableCategories.find(c => c.id === currentState.categoryId)?.name;

      return {
        result: {
          success: true,
          data: {
            title: currentState.title || "(not set)",
            description: currentState.description || "(not set)",
            content: currentState.content || "(not set)",
            type: currentState.type,
            structuredFormat: currentState.structuredFormat,
            tags: tagNames.length ? tagNames : "(none)",
            category: categoryName || "(none)",
            isPrivate: currentState.isPrivate,
            requiresMediaUpload: currentState.requiresMediaUpload,
            mediaType: currentState.requiredMediaType,
            mediaCount: currentState.requiredMediaCount
          }
        },
        newState
      };
    }

    default:
      return {
        result: { success: false, error: `Unknown tool: ${toolName}` },
        newState
      };
  }
}
