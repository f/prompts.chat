"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Download, FileCode2, Share2 } from "lucide-react";
import { toast } from "sonner";

interface PromptExporterProps {
  title?: string;
  promptText: string;
  description?: string;
  author?: string;
  tags?: string[];
}

export function PromptExporter({
  title = "Untitled Prompt",
  promptText,
  description = "Custom prompt template",
  author = "Nexus Prompts User",
  tags = ["ai", "assistant"],
}: PromptExporterProps) {
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  const formatMarkdown = `# ${title}

> ${description}

**Author:** ${author}
**Tags:** ${tags.map((t) => `#${t}`).join(" ")}

\`\`\`markdown
${promptText}
\`\`\`
`;

  const formatJson = JSON.stringify(
    {
      title,
      description,
      author,
      tags,
      promptText,
      version: "1.0.0",
      type: "system_prompt",
    },
    null,
    2
  );

  const formatYaml = `title: "${title}"
description: "${description}"
author: "${author}"
tags: [${tags.map((t) => `"${t}"`).join(", ")}]
version: "1.0.0"
prompt: |
  ${promptText.split("\n").join("\n  ")}
`;

  const formatMcp = JSON.stringify(
    {
      name: title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      description,
      arguments: [],
      template: promptText,
    },
    null,
    2
  );

  const handleCopy = (formatName: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedFormat(formatName);
    toast.success(`Copied as ${formatName.toUpperCase()}`);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const handleDownload = (formatName: string, content: string, extension: string) => {
    const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.${extension}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  return (
    <Card className="glass-card shadow-sm border-indigo-500/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-indigo-500" />
            <CardTitle className="text-lg font-semibold">Multi-Format Exporter</CardTitle>
          </div>
          <Share2 className="w-4 h-4 text-muted-foreground" />
        </div>
        <CardDescription className="text-xs">
          Export prompt into standard developer and AI model formats
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="markdown" className="w-full">
          <TabsList className="grid grid-cols-4 mb-4 text-xs">
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
            <TabsTrigger value="json">JSON</TabsTrigger>
            <TabsTrigger value="yaml">YAML</TabsTrigger>
            <TabsTrigger value="mcp">MCP</TabsTrigger>
          </TabsList>

          {[
            { id: "markdown", label: "Markdown", content: formatMarkdown, ext: "md" },
            { id: "json", label: "JSON", content: formatJson, ext: "json" },
            { id: "yaml", label: "YAML", content: formatYaml, ext: "yaml" },
            { id: "mcp", label: "MCP Protocol", content: formatMcp, ext: "json" },
          ].map((item) => (
            <TabsContent key={item.id} value={item.id} className="space-y-3">
              <div className="relative">
                <pre className="p-3 bg-muted/60 rounded-md font-mono text-xs overflow-x-auto max-h-48 border text-foreground/90">
                  {item.content}
                </pre>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(item.id, item.content)}
                  className="gap-1 text-xs"
                >
                  {copiedFormat === item.id ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedFormat === item.id ? "Copied" : "Copy"}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleDownload(item.id, item.content, item.ext)}
                  className="gap-1 text-xs bg-indigo-600 hover:bg-indigo-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .{item.ext}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
