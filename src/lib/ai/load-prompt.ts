import { parse } from "yaml";
import { readBundledText } from "@/lib/bundled-files";

// Cache for loaded prompts
const promptCache = new Map<string, PromptFile>();

export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PromptFile {
  name: string;
  description: string;
  model?: string;
  modelParameters?: {
    temperature?: number;
    maxTokens?: number;
  };
  messages: PromptMessage[];
  testData?: Array<Record<string, unknown>>;
}

/**
 * Load and parse a .prompt.yml file
 * @param relativePath - Path relative to project root (e.g., "src/lib/ai/translate.prompt.yml")
 * @returns Parsed prompt file content
 */
export function loadPrompt(relativePath: string): PromptFile {
  // Check cache first
  if (promptCache.has(relativePath)) {
    return promptCache.get(relativePath)!;
  }

  const content = readBundledText(relativePath);
  if (content === undefined) {
    throw new Error(`${relativePath} is not bundled. Run \`npm run generate:bundled-files\`.`);
  }
  const prompt = parse(content) as PromptFile;
  
  // Cache the result
  promptCache.set(relativePath, prompt);
  
  return prompt;
}

/**
 * Get the system message content from a prompt file
 * @param prompt - The parsed prompt file
 * @returns The system message content or empty string if not found
 */
export function getSystemPrompt(prompt: PromptFile): string {
  const systemMessage = prompt.messages.find((m) => m.role === "system");
  return systemMessage?.content || "";
}

/**
 * Interpolate variables in a prompt template
 * @param template - The prompt template with {{variable}} placeholders
 * @param variables - Object containing variable values
 * @returns The interpolated string
 */
export function interpolatePrompt(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
