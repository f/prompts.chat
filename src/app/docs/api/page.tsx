import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { buildPageMetadata } from "@/lib/seo";
import { Code, Zap, Terminal, Search, Box, Key, Save, Sparkles, Cpu, FilePlus, FileX, Bot, List, Link2 } from "lucide-react";
import { ImprovePromptDemo } from "@/components/api/improve-prompt-demo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { McpConfigTabs } from "@/components/mcp/mcp-config-tabs";
import config from "@/../prompts.config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo.apiDocs");
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/docs/api",
  });
}

export default async function ApiDocsPage() {
  const t = await getTranslations("apiDocs");
  const code = (chunks: ReactNode) => <code className="text-xs">{chunks}</code>;
  const headersList = await headers();
  const host = headersList.get("host") || "prompts.chat";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;
  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-2xl font-bold mb-2">API Documentation</h1>
      <p className="text-muted-foreground mb-8">
        {config.features.mcp !== false 
          ? "prompts.chat provides an MCP-first API for searching and discovering AI prompts programmatically. Use the MCP endpoint directly with any MCP-compatible client, or make standard HTTP requests."
          : "prompts.chat provides an API for searching and discovering AI prompts programmatically."
        }
      </p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10">
        {config.features.mcp !== false && (
          <>
            {/* MCP Overview */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5" />
                MCP-First API
              </h2>
              <p className="text-muted-foreground">
                Our API is built on the{" "}
                <Link
                  href="https://modelcontextprotocol.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Model Context Protocol (MCP)
                </Link>
                , enabling seamless integration with AI assistants, IDEs, and automation tools.
                The same endpoint works for both MCP clients and traditional REST-style requests.
              </p>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                <p className="text-muted-foreground"># MCP Endpoint</p>
                <p>POST {baseUrl}/api/mcp</p>
              </div>
            </section>

            {/* Using with MCP Clients */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Using with MCP Clients
              </h2>
              <p className="text-muted-foreground">
                Add prompts.chat to your MCP client configuration. Choose your client and connection type below:
              </p>
              <McpConfigTabs baseUrl={baseUrl} className="[&_button]:text-sm [&_button]:px-3 [&_button]:py-1.5 [&_pre]:text-sm [&_pre]:p-4" />
              <p className="text-muted-foreground text-sm">
                <strong>Remote</strong> connects directly to prompts.chat API. <strong>Local</strong> runs the MCP server locally via npx.
              </p>
            </section>

            {/* Authentication */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Key className="h-5 w-5" />
                Authentication
              </h2>
              <p className="text-muted-foreground">
                Most API features work without authentication. However, to save prompts via MCP or access your private prompts,
                you need to authenticate using an API key.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                <div>
                  <p className="font-medium">Generate an API Key</p>
                  <p className="text-muted-foreground">
                    Go to{" "}
                    <Link href="/settings" className="underline hover:text-foreground">
                      Settings
                    </Link>
                    {" "}to generate your API key. Keys start with <code className="bg-muted px-1.5 py-0.5 rounded">pchat_</code>.
                  </p>
                </div>
                <div>
                  <p className="font-medium">Using the API Key</p>
                  <p className="text-muted-foreground">
                    Pass your API key via the <code className="bg-muted px-1.5 py-0.5 rounded">PROMPTS_API_KEY</code> header.
                    An <code className="bg-muted px-1.5 py-0.5 rounded">Authorization: Bearer</code> header,{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded">x-api-key</code> header or{" "}
                    <code className="bg-muted px-1.5 py-0.5 rounded">?api_key=</code> query parameter also work.
                  </p>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`# Remote: HTTP transport with headers
"prompts-chat": {
  "url": "${baseUrl}/api/mcp",
  "headers": {
    "PROMPTS_API_KEY": "pchat_your_api_key_here"
  }
}

# Local: stdio transport with environment variable
"prompts-chat": {
  "command": "npx",
  "args": ["-y", "@fkadev/prompts.chat-mcp"],
  "env": {
    "PROMPTS_API_KEY": "pchat_your_api_key_here"
  }
}

# Or via curl (remote)
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "PROMPTS_API_KEY: pchat_your_api_key_here" \\
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'`}</pre>
              </div>

              <p className="text-muted-foreground text-sm">
                <strong>Remote (HTTP)</strong> sends requests to prompts.chat with the API key in headers. 
                <strong> Local (stdio)</strong> runs the MCP server locally via npx with the API key as an environment variable.
                With authentication, you can use the <code className="bg-muted px-1.5 py-0.5 rounded">save_prompt</code> and{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded">save_bot</code> tools
                and search results will include your private prompts.
                The endpoint is stateless: every POST is answered with a plain JSON response, so no session or
                SSE stream is needed.
              </p>
            </section>

            {/* MCP Prompts */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                MCP Prompts
              </h2>
              <p className="text-muted-foreground">
                All public prompts are exposed as native MCP prompts. This allows MCP clients to list 
                and use prompts directly via slash commands or prompt pickers. You can filter prompts 
                by category or tag using URL query parameters.
              </p>
              
              <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`# Filter by users (one or more usernames)
"prompts-chat": {
  "url": "${baseUrl}/api/mcp?users=f,torvalds"
}

# Filter by categories
"prompts-chat": {
  "url": "${baseUrl}/api/mcp?categories=coding,marketing"
}

# Filter by tags
"prompts-chat": {
  "url": "${baseUrl}/api/mcp?tags=chatgpt,writing"
}

# Combine filters
"prompts-chat": {
  "url": "${baseUrl}/api/mcp?users=f&categories=coding&tags=js"
}`}</pre>
              </div>
              
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                <div>
                  <p className="font-medium">prompts/list</p>
                  <p className="text-muted-foreground">
                    Browse all available prompts with pagination support. Each prompt lists its variables as arguments;
                    variables without a default are required.
                  </p>
                </div>
                <div>
                  <p className="font-medium">prompts/get</p>
                  <p className="text-muted-foreground">
                    Retrieve a prompt by ID. Variables ({"${name}"} or {"${name:default}"}) are automatically 
                    substituted with provided arguments.
                  </p>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`# List prompts
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc": "2.0", "id": 1, "method": "prompts/list"}'

# Get a specific prompt with arguments
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "prompts/get",
    "params": {
      "name": "code-review-assistant",
      "arguments": { "topic": "AI safety" }
    }
  }'`}</pre>
              </div>
            </section>

            {/* Available Tools */}
            <section className="space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Box className="h-5 w-5" />
                Available Tools
              </h2>

          {/* search_prompts Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              search_prompts
            </h3>
            <p className="text-muted-foreground">
              Search for AI prompts by keyword. Returns matching prompts with title, description, 
              content, author, category, and tags.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">query</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Search query to find relevant prompts</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">limit</TableCell>
                    <TableCell className="text-muted-foreground text-xs">number</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Maximum results (default: 10, max: 50)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">cursor</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">The <code className="text-xs">nextCursor</code> of a previous result, for the next page</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">type</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      Filter by type: <code className="text-xs">TEXT</code>, <code className="text-xs">STRUCTURED</code>, <code className="text-xs">IMAGE</code>, <code className="text-xs">VIDEO</code>, <code className="text-xs">AUDIO</code>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">category</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Filter by category slug</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">tag</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Filter by tag slug</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* get_prompt Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Box className="h-4 w-4" />
              get_prompt
            </h3>
            <p className="text-muted-foreground">
              Get a prompt by ID, with its template variables (like {"${variable}"} or {"${variable:default}"}).
              Pass <code className="text-xs">variables</code> to get the prompt filled in.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">id</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">The ID of the prompt to retrieve</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">variables</TableCell>
                    <TableCell className="text-muted-foreground text-xs">object</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Values for the template variables, by name</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">Filling Variables</p>
              <p className="text-muted-foreground">
                The result lists the prompt&apos;s <code className="text-xs">variables</code>. With{" "}
                <code className="text-xs">variables</code> given, <code className="text-xs">content</code> holds the filled
                prompt and <code className="text-xs">originalContent</code> the template. Variables with a default (after the
                colon) are optional; any required ones still missing are listed in{" "}
                <code className="text-xs">missingVariables</code>, so the agent can ask the user and call again.
              </p>
            </div>
          </div>

          {/* save_prompt Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Save className="h-4 w-4" />
              save_prompt
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
            </h3>
            <p className="text-muted-foreground">
              Save a new prompt to your account. Requires API key authentication. Prompts are private by default
              unless you&apos;ve changed the default in your settings.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">title</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Title of the prompt (max 200 chars)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">content</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">The prompt content. Can include variables like {"${var}"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">description</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Optional description (max 500 chars)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">tags</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string[]</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Array of tag names (max 10)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">category</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Category slug</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">isPrivate</TableCell>
                    <TableCell className="text-muted-foreground text-xs">boolean</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Override default privacy setting</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">type</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <code className="text-xs">TEXT</code> (default), <code className="text-xs">STRUCTURED</code>, <code className="text-xs">IMAGE</code>, <code className="text-xs">VIDEO</code>, <code className="text-xs">AUDIO</code>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`# Save a prompt via MCP
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "PROMPTS_API_KEY: pchat_your_api_key_here" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "save_prompt",
      "arguments": {
        "title": "My Code Review Prompt",
        "content": "Review this code for \${language} best practices:\\n\\n\${code}",
        "description": "A helpful code review assistant",
        "tags": ["coding", "review"],
        "isPrivate": false
      }
    }
  }'`}</pre>
            </div>
          </div>

          {/* improve_prompt Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              improve_prompt
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
            </h3>
            <p className="text-muted-foreground">
              Transform a basic prompt into a well-structured, comprehensive prompt using AI.
              Searches for similar prompts for inspiration and generates improved versions.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">prompt</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">The prompt to improve (max 10,000 chars)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">outputType</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      Content type: <code className="text-xs">text</code> (default), <code className="text-xs">image</code>, <code className="text-xs">video</code>, <code className="text-xs">sound</code>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">outputFormat</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      Response format: <code className="text-xs">text</code> (default), <code className="text-xs">structured_json</code>, <code className="text-xs">structured_yaml</code>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`# Improve a prompt via MCP
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "PROMPTS_API_KEY: pchat_your_api_key_here" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "improve_prompt",
      "arguments": {
        "prompt": "write a blog post about AI",
        "outputType": "text",
        "outputFormat": "text"
      }
    }
  }'`}</pre>
            </div>
          </div>

          {/* save_skill Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              save_skill
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
            </h3>
            <p className="text-muted-foreground">
              Save a new Agent Skill to your account. Skills are multi-file prompts that can include SKILL.md (required),
              reference docs, scripts, and configuration files. Perfect for creating comprehensive coding agent skills.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">title</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Title of the skill (max 200 chars)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">files</TableCell>
                    <TableCell className="text-muted-foreground text-xs">array</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      Array of {`{filename, content}`}. Must include <code className="text-xs">SKILL.md</code>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">description</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Optional description (max 500 chars)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">tags</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string[]</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Array of tag names (max 10)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">category</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Category slug</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">isPrivate</TableCell>
                    <TableCell className="text-muted-foreground text-xs">boolean</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Override default privacy setting</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`# Save a skill via MCP
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "PROMPTS_API_KEY: pchat_your_api_key_here" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "save_skill",
      "arguments": {
        "title": "PDF Processing Skill",
        "description": "Comprehensive PDF manipulation toolkit",
        "files": [
          {"filename": "SKILL.md", "content": "# PDF Processing\\n\\nThis skill helps with PDF manipulation..."},
          {"filename": "reference.md", "content": "# API Reference\\n\\n..."},
          {"filename": "scripts/extract.py", "content": "import pypdf\\n..."}
        ],
        "tags": ["pdf", "documents"]
      }
    }
  }'`}</pre>
            </div>
          </div>

          {/* add_file_to_skill Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <FilePlus className="h-4 w-4" />
              add_file_to_skill
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
            </h3>
            <p className="text-muted-foreground">
              Add a new file to an existing Agent Skill. Use this to add reference docs, scripts, or configuration files.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">skillId</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">ID of the skill to add the file to</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">filename</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      File path (e.g., <code className="text-xs">reference.md</code>, <code className="text-xs">scripts/helper.py</code>)
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">content</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">File content</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* remove_file_from_skill Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <FileX className="h-4 w-4" />
              remove_file_from_skill
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
            </h3>
            <p className="text-muted-foreground">
              Remove a file from an existing Agent Skill. Cannot remove SKILL.md as it is required.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">skillId</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">ID of the skill to remove the file from</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">filename</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">File path to remove (cannot be SKILL.md)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* get_skill Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              get_skill
            </h3>
            <p className="text-muted-foreground">
              Get an Agent Skill by ID, including all its files (SKILL.md, reference docs, scripts, etc.).
              Returns skill metadata and file contents. Public skills are accessible without authentication;
              private skills require API key authentication.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">id</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">The ID of the skill to retrieve</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`# Get a skill via MCP
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_skill",
      "arguments": {
        "id": "skill_id_here"
      }
    }
  }'`}</pre>
            </div>
          </div>

          {/* search_bots Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Search className="h-4 w-4" />
              search_bots
            </h3>
            <p className="text-muted-foreground">
              Search the public <Link href="/bots" className="underline hover:text-foreground">bots directory</Link>.
              Returns bot summaries; use <code className="text-xs">get_bot</code> for the full definition and install
              instructions. With <code className="text-xs">semantic: true</code> and AI search enabled, results are
              ranked by meaning; otherwise keyword search is used and <code className="text-xs">searchMode</code> says so.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">query</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Keywords; separate alternatives with commas</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">platform</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Only bots for this platform, e.g. <code className="text-xs">HERMES</code></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">computerRequirement</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.rich("computerRequirementFilter", { code })}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">category</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Category slug (includes its subcategories)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">tags</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string[]</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Tag slugs; every tag must match</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">sort</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm"><code className="text-xs">newest</code> (default), <code className="text-xs">oldest</code> or <code className="text-xs">upvotes</code></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">semantic</TableCell>
                    <TableCell className="text-muted-foreground text-xs">boolean</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Rank by meaning using AI search when available</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">limit / cursor</TableCell>
                    <TableCell className="text-muted-foreground text-xs">number / string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Page size (default 10, max 50) and the <code className="text-xs">nextCursor</code> of the previous page</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* get_bot Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Bot className="h-4 w-4" />
              get_bot
            </h3>
            <p className="text-muted-foreground">
              Get a bot by <code className="text-xs">id</code> (or its <code className="text-xs">id_slug</code> URL segment) or{" "}
              <code className="text-xs">slug</code>: its instructions, routines, skills and connectors, an{" "}
              <code className="text-xs">install</code> entry per platform (one-click link, a prompt to paste into the agent, or a CLI
              command) and the bots it works well with. Public and unlisted bots are visible to everyone; private bots only to their owner.
            </p>

            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/call",
       "params": {"name": "get_bot", "arguments": {"slug": "inbox-triage"}}}'`}</pre>
            </div>
          </div>

          {/* save_bot Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Bot className="h-4 w-4" />
              save_bot
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
            </h3>
            <p className="text-muted-foreground">
              Create or update one of your own <Link href="/bots" className="underline hover:text-foreground">bots</Link>,
              so an agent connected over MCP can back up its own definition. It is an idempotent upsert: it updates your bot
              matching <code className="text-xs">id</code>, else <code className="text-xs">slug</code>, else <code className="text-xs">name</code>{" "}
              (case-insensitive), and only creates a bot when none matches. Sending the same definition again changes nothing.
              On update, omitted optional fields keep their stored values. Bots go through the same validation, limits and
              moderation as the bot form, and new bots are private by default unless your settings say otherwise.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">name</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Bot name (max 200 chars)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">instructions</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">The bot&apos;s standing instructions (its system prompt)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">platforms</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string[]</TableCell>
                    <TableCell className="text-xs">Yes</TableCell>
                    <TableCell className="text-muted-foreground text-sm">One or more of <code className="text-xs">GROK_BOT</code>, <code className="text-xs">OPENCLAW</code>, <code className="text-xs">HERMES</code>, <code className="text-xs">AUTOGPT</code>, <code className="text-xs">DOTS</code>, <code className="text-xs">DUET</code>, <code className="text-xs">MUSE</code></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">id</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Update this bot; it must be one of yours</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">slug</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Match your existing bot by slug (falls back to matching by name)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">description</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Short summary (max 500 chars)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">icon / color</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string | null</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">A preset icon and color from the bot form; null resets to the default</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">installUrl</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string | null</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">https one-click install link (Grok Bot template link)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">computerRequirement</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.rich("computerRequirementInput", { code })}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">routines</TableCell>
                    <TableCell className="text-muted-foreground text-xs">array</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{`{name, type: "schedule" | "event", trigger, triggerLabel?, prompt}`} (max 20, replaces all)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">skills</TableCell>
                    <TableCell className="text-muted-foreground text-xs">array</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{`{name, description?, source?}`} (max 20, replaces all)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">connectors</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string[]</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Connectors the user must connect, e.g. Gmail (max 20, replaces all)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">category</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string | null</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Category slug; null removes it</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">tags</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string[]</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Tag names (max 10, replaces all)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">isPrivate</TableCell>
                    <TableCell className="text-muted-foreground text-xs">boolean</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Override the default privacy setting (applies on create; on update only when given)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`# Back up a bot via MCP (run it again any time to sync changes)
curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "PROMPTS_API_KEY: pchat_your_api_key_here" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "save_bot",
      "arguments": {
        "name": "Inbox Triage",
        "description": "Sorts my inbox every morning",
        "instructions": "You triage my email. Label, archive and summarize...",
        "platforms": ["OPENCLAW", "HERMES"],
        "icon": "inbox",
        "color": "sky",
        "routines": [{
          "name": "Morning triage",
          "type": "schedule",
          "trigger": "0 8 * * *",
          "triggerLabel": "Every day at 08:00",
          "prompt": "Triage unread email and send me a summary."
        }],
        "connectors": ["Gmail"],
        "tags": ["email"]
      }
    }
  }'

# Result: {"success": true, "action": "created" | "updated" | "unchanged",
#          "changedFields": [...], "bot": {"id": "...", "slug": "inbox-triage", ...}, "link": ...}`}</pre>
            </div>
          </div>

          {/* list_my_bots Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <List className="h-4 w-4" />
              list_my_bots
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
            </h3>
            <p className="text-muted-foreground">
              List your own bots, including private ones, newest first, with their ids and slugs.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">limit</TableCell>
                    <TableCell className="text-muted-foreground text-xs">number</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Maximum bots to return (default 50, max 100)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">cursor</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">No</TableCell>
                    <TableCell className="text-muted-foreground text-sm">The <code className="text-xs">nextCursor</code> of a previous result (<code className="text-xs">offset</code> still works but is deprecated)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* get_my_bot Tool */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Bot className="h-4 w-4" />
              get_my_bot
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
            </h3>
            <p className="text-muted-foreground">
              Get the full definition of one of your bots (instructions, platforms, routines, skills, connectors and
              install options), including private ones, for example to restore a bot from its backup.
            </p>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Parameter</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px]">Required</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">id</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">One of</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Bot id</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">slug</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-xs">One of</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Bot slug, used when no id is given</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </section>

            {/* MCP Resources */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                MCP Resources
              </h2>
              <p className="text-muted-foreground">
                Prompts, skills and bots can also be read as MCP resources. Tool results include{" "}
                <code className="text-xs">resource_link</code> entries pointing at them, and{" "}
                <code className="text-xs">resources/list</code> lists your own items when you are authenticated.
                Resources follow the same visibility rules as the tools.
              </p>
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2 font-mono">
                <p>prompts-chat://prompts/{"{id}"} <span className="text-muted-foreground font-sans">: a prompt as Markdown</span></p>
                <p>prompts-chat://skills/{"{id}"} <span className="text-muted-foreground font-sans">: every file of a skill</span></p>
                <p>prompts-chat://skills/{"{id}"}/files/{"{path}"} <span className="text-muted-foreground font-sans">: one skill file</span></p>
                <p>prompts-chat://bots/{"{id}"} <span className="text-muted-foreground font-sans">: a bot&apos;s definition and setup steps as Markdown</span></p>
              </div>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc": "2.0", "id": 1, "method": "resources/read",
       "params": {"uri": "prompts-chat://bots/bot_id_here"}}'`}</pre>
              </div>
            </section>

            {/* MCP Protocol Example */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Code className="h-5 w-5" />
                MCP Protocol Examples
              </h2>

              <div className="space-y-3">
                <h3 className="font-medium">Initialize Connection</h3>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre>{`curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-11-25",
      "capabilities": {},
      "clientInfo": { "name": "my-app", "version": "1.0.0" }
    }
  }'`}</pre>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">List Available Tools</h3>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre>{`curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
  }'`}</pre>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Search Prompts</h3>
                <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <pre>{`curl -X POST ${baseUrl}/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_prompts",
      "arguments": {
        "query": "code review",
        "limit": 5
      }
    }
  }'`}</pre>
                </div>
              </div>
            </section>

            {/* Response Format */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Response Format</h2>
              <p className="text-muted-foreground">
                Tools return their result as <code className="bg-muted px-1.5 py-0.5 rounded text-sm">structuredContent</code>,
                described by the tool&apos;s <code className="bg-muted px-1.5 py-0.5 rounded text-sm">outputSchema</code>, and the same
                JSON as a text block for older clients, followed by resource links. Errors set{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm">isError</code> with{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{`{"error": "...", "code": "..."}`}</code>. For example,{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm">search_prompts</code> returns:
              </p>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre>{`{
  "query": "code review",
  "count": 2,
  "prompts": [
    {
      "id": "abc123",
      "title": "Code Review Assistant",
      "description": "A prompt for conducting thorough code reviews",
      "contentPreview": "You are an expert code reviewer...",
      "type": "TEXT",
      "author": "username",
      "category": "Development",
      "tags": ["coding", "review", "development"],
      "votes": 42,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "link": "${baseUrl}/prompts/abc123_code-review-assistant"
    }
  ],
  "nextCursor": "Mg"
}`}</pre>
              </div>
            </section>
          </>
        )}

        {/* Improve Prompt API */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Improve Prompt API
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Requires Auth</span>
          </h2>
          <p className="text-muted-foreground">
            Transform basic prompts into well-structured, comprehensive prompts using AI.
            The API uses embeddings to find similar prompts for inspiration and generates
            improved versions while preserving the original intent. Requires API key authentication.
          </p>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 text-sm font-medium w-[120px]">Parameter</th>
                  <th className="text-left p-3 text-sm font-medium w-[100px]">Type</th>
                  <th className="text-left p-3 text-sm font-medium w-[80px]">Required</th>
                  <th className="text-left p-3 text-sm font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className="p-3 font-mono text-xs">prompt</td>
                  <td className="p-3 text-muted-foreground text-xs">string</td>
                  <td className="p-3 text-xs">Yes</td>
                  <td className="p-3 text-muted-foreground text-sm">The prompt to improve (max 10,000 chars)</td>
                </tr>
                <tr className="border-t">
                  <td className="p-3 font-mono text-xs">outputType</td>
                  <td className="p-3 text-muted-foreground text-xs">string</td>
                  <td className="p-3 text-xs">No</td>
                  <td className="p-3 text-muted-foreground text-sm">
                    Content type: <code className="text-xs">text</code> (default), <code className="text-xs">image</code>, <code className="text-xs">video</code>, <code className="text-xs">sound</code>
                  </td>
                </tr>
                <tr className="border-t">
                  <td className="p-3 font-mono text-xs">outputFormat</td>
                  <td className="p-3 text-muted-foreground text-xs">string</td>
                  <td className="p-3 text-xs">No</td>
                  <td className="p-3 text-muted-foreground text-sm">
                    Response format: <code className="text-xs">text</code> (default), <code className="text-xs">structured_json</code>, <code className="text-xs">structured_yaml</code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre>{`# Improve a prompt
curl -X POST ${baseUrl}/api/improve-prompt \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: pchat_your_api_key_here" \\
  -d '{
    "prompt": "write a blog post about AI",
    "outputType": "text",
    "outputFormat": "text"
  }'`}</pre>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
            <div>
              <p className="font-medium">Response Format</p>
              <pre className="mt-2 text-xs text-muted-foreground">{`{
  "original": "write a blog post about AI",
  "improved": "You are an expert technology writer...\n\n## Task\nWrite an engaging blog post...",
  "outputType": "text",
  "outputFormat": "text",
  "inspirations": [
    { "title": "Blog Writer", "similarity": 85 },
    { "title": "Content Creator", "similarity": 72 }
  ],
  "model": "gpt-4o"
}`}</pre>
            </div>
          </div>

          <div className="pt-4">
            <h3 className="font-medium mb-4">Try It Out</h3>
            <ImprovePromptDemo />
          </div>
        </section>

        {/* REST API Alternative */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">REST API</h2>
          <p className="text-muted-foreground">
            Use the standard REST endpoint to search and retrieve prompts:
          </p>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre>{`# Search prompts via REST
curl "${baseUrl}/api/prompts?q=code+review&perPage=10"

# Get prompt by ID
curl "${baseUrl}/api/prompts/{id}"`}</pre>
          </div>
        </section>

        {/* Rate Limits */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Rate Limits</h2>
          <p className="text-muted-foreground">
            The API is public and free to use. Please be respectful with request frequency.
            For high-volume usage, consider{" "}
            <Link
              href="/docs/self-hosting"
              className="underline hover:text-foreground"
            >
              self-hosting your own instance
            </Link>
            .
          </p>
        </section>

        {/* Support */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Support</h2>
          <p className="text-muted-foreground">
            For issues and feature requests, please open a{" "}
            <Link
              href="https://github.com/f/prompts.chat/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              GitHub Issue
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
