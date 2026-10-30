import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext } from "./context";
import { registerPrompts } from "./prompts";
import { registerResources } from "./resources";
import { registerBotTools } from "./tools/bots";
import { registerPromptTools } from "./tools/prompts";
import { registerSkillTools } from "./tools/skills";

const INSTRUCTIONS = `prompts.chat is a community library of AI prompts, Agent Skills and bots.
- Discover: search_prompts, search_skills and search_bots, then get_prompt, get_skill or get_bot for the full item. Results also link to prompts-chat:// resources you can read.
- Prompts with \${variable} placeholders: pass values in get_prompt's \`variables\`; ask the user for any listed in missingVariables.
- Saving (save_prompt, save_skill, save_bot, skill file tools) and improve_prompt need an API key from prompts.chat/settings.
- An agent can back itself up with save_bot (an idempotent upsert of your own bot) and restore with get_my_bot.
- Paged results return nextCursor; pass it back as cursor for the next page.`;

/** A server for one request: stateless, so every request builds its own with that request's user */
export function createMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    {
      name: "prompts-chat",
      version: "1.1.0",
      title: "prompts.chat",
      description: "Search, use and save AI prompts, Agent Skills and bots from prompts.chat",
      websiteUrl: ctx.baseUrl,
      icons: [{ src: `${ctx.baseUrl}/logo.svg`, mimeType: "image/svg+xml" }],
    },
    {
      capabilities: {
        tools: { listChanged: false },
        prompts: { listChanged: false },
        resources: { listChanged: false },
      },
      instructions: INSTRUCTIONS,
    }
  );

  registerPromptTools(server, ctx);
  registerSkillTools(server, ctx);
  registerBotTools(server, ctx);
  registerPrompts(server, ctx);
  registerResources(server, ctx);
  // Registering tools and resources turns listChanged on, but a stateless server never sends those notifications
  server.server.registerCapabilities({ tools: { listChanged: false }, resources: { listChanged: false } });

  return server;
}
