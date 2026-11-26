import { getServerPrompt, callServerTool, toolData } from "./server-client";
import { currentPromptId } from "./tools";
import type { GetPromptResult, WebMcpEnv, WebMcpPrompt } from "./types";

function parseVariables(value: string | undefined): Record<string, string> {
  if (!value?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('`variables` must be a JSON object, e.g. {"topic": "climate"}');
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error('`variables` must be a JSON object, e.g. {"topic": "climate"}');
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, v]) => [key, String(v)]));
}

function userMessage(text: string, description: string): GetPromptResult {
  return { description, messages: [{ role: "user", content: { type: "text", text } }] };
}

const VARIABLES_ARGUMENT = {
  name: "variables",
  description: 'Values for the prompt\'s ${variable} placeholders as a JSON object, e.g. {"topic": "climate"}',
  required: false,
};

/** MCP prompts built from prompts.chat content */
export function createPrompts(env: WebMcpEnv): WebMcpPrompt[] {
  return [
    {
      name: "use_prompt",
      description: "Use a prompts.chat prompt by slug or id, with its ${variable} placeholders filled in",
      arguments: [{ name: "prompt", description: "Prompt slug or id, e.g. from search_prompts", required: true }, VARIABLES_ARGUMENT],
      get: async (args) => {
        const name = args.prompt?.trim();
        if (!name) throw new Error("Pass the slug or id of a prompt");
        return getServerPrompt(env, name, parseVariables(args.variables));
      },
    },
    {
      name: "use_current_prompt",
      description: "Use the prompt open in the browser, with its ${variable} placeholders filled in",
      arguments: [VARIABLES_ARGUMENT],
      get: async (args) => {
        const id = await currentPromptId(env);
        if (!id) throw new Error("The current page does not show a prompt");
        const data = toolData(await callServerTool(env, "get_prompt", { id, variables: parseVariables(args.variables) }));
        if (!data || typeof data.content !== "string") throw new Error("Prompt not found");
        const missing = Array.isArray(data.missingVariables) ? (data.missingVariables as string[]) : [];
        const description = missing.length > 0 ? `${data.title} (missing: ${missing.join(", ")})` : String(data.title);
        return userMessage(data.content, description);
      },
    },
    {
      name: "find_prompt",
      description: "Find the best prompts.chat prompt for a task and use it",
      arguments: [{ name: "task", description: "What you want the prompt to do", required: true }],
      get: async (args) => {
        const task = args.task?.trim();
        if (!task) throw new Error("Describe the task");
        return userMessage(
          `Find the best prompt on prompts.chat for this task: ${task}\n\n` +
            "Search with search_prompts (try a few keyword variations), pick the best match by title, description and votes, " +
            "and get it with get_prompt. If it has ${variable} placeholders, ask me for the missing values, " +
            "fill them with fill_prompt_variables, then show me the final prompt and its link.",
          `Find a prompt for: ${task}`
        );
      },
    },
  ];
}
