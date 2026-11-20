import { snapshotMarkdown, snapshotPage } from "./page";
import { readServerResource, toolData } from "./server-client";
import { getCurrentItem } from "./tools";
import type { WebMcpEnv, WebMcpResource } from "./types";

export const PAGE_RESOURCE_URI = "page://current";
export const CURRENT_ITEM_RESOURCE_URI = "prompts-chat://current-item";

const PAGE_TEXT_LIMIT = 50000;

/** MCP resources: the open page, the item it shows, and the server's prompts-chat:// resources */
export function createResources(env: WebMcpEnv): WebMcpResource[] {
  const proxied = (kind: string, title: string, description: string): WebMcpResource => ({
    name: kind,
    description: `${title}: ${description}`,
    uriTemplate: `prompts-chat://${kind}/{id}`,
    mimeType: "text/markdown",
    read: (uri) => readServerResource(env, uri),
  });

  return [
    {
      name: "current-page",
      description: "The page open in the browser on prompts.chat, as Markdown: title, URL, locale and main text",
      uri: PAGE_RESOURCE_URI,
      mimeType: "text/markdown",
      read: async (uri) => ({
        contents: [{ uri, mimeType: "text/markdown", text: snapshotMarkdown(snapshotPage(env.document(), env.location(), PAGE_TEXT_LIMIT)) }],
      }),
    },
    {
      name: "current-item",
      description: "The prompt, skill, bot, team or classifier shown on the current page, as JSON",
      uri: CURRENT_ITEM_RESOURCE_URI,
      mimeType: "application/json",
      read: async (uri) => {
        const item = await getCurrentItem(env);
        if (item.isError) throw new Error(String(toolData(item)?.error ?? "No item on this page"));
        return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(toolData(item)) }] };
      },
    },
    proxied("prompts", "Prompt", "a prompt as Markdown, by id"),
    proxied("skills", "Agent Skill", "every file of a skill, by id; prompts-chat://skills/{id}/files/{path} reads one file"),
    proxied("bots", "Bot", "a bot's full definition as Markdown, by id"),
  ];
}
