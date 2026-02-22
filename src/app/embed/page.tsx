"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { RunPromptButton } from "@/components/prompts/run-prompt-button";
import DOMPurify from "dompurify";

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
}

function buildFileTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  
  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLastPart = i === parts.length - 1;
      const isFolder = path.endsWith("/") ? true : !isLastPart;
      
      let existing = currentLevel.find(n => n.name === part);
      
      if (!existing) {
        existing = {
          name: part,
          path: isFolder ? `${currentPath}/` : currentPath,
          isFolder,
          children: [],
        };
        currentLevel.push(existing);
      }
      
      if (isFolder) {
        currentLevel = existing.children;
      }
    }
  }
  
  // Sort: folders first, then alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      })
      .map(n => ({ ...n, children: sortNodes(n.children) }));
  };
  
  return sortNodes(root);
}

interface EmbedConfig {
  prompt: string;
  context: string[];
  model: string;
  mode: string;
  thinking: boolean;
  reasoning: boolean;
  planning: boolean;
  fast: boolean;
  max: boolean;
  lightColor: string;
  darkColor: string;
  themeMode: "auto" | "light" | "dark";
  filetree: string[];
  showDiff: boolean;
  diffFilename: string;
  diffOldText: string;
  diffNewText: string;
  flashButton: string;
  mcpTools: string[];
}

function EmbedContent() {
  const searchParams = useSearchParams();
  const [isDark, setIsDark] = useState(false);
  const [diffCollapsed, setDiffCollapsed] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const config: EmbedConfig = {
    prompt: searchParams?.get("prompt") || "",
    context: searchParams?.get("context")?.split(",").map(c => c.trim()).filter(Boolean) || [],
    model: searchParams?.get("model") || "GPT 4o",
    mode: searchParams?.get("mode") || "chat",
    thinking: searchParams?.get("thinking") === "true",
    reasoning: searchParams?.get("reasoning") === "true",
    planning: searchParams?.get("planning") === "true",
    fast: searchParams?.get("fast") === "true",
    max: searchParams?.get("max") === "true",
    lightColor: searchParams?.get("lightColor") || "#3b82f6",
    darkColor: searchParams?.get("darkColor") || "#60a5fa",
    themeMode: (searchParams?.get("themeMode") as EmbedConfig["themeMode"]) || "auto",
    filetree: searchParams?.get("filetree")?.split("\n").filter(Boolean) || [],
    showDiff: searchParams?.get("showDiff") === "true",
    diffFilename: searchParams?.get("diffFilename") || "",
    diffOldText: searchParams?.get("diffOldText") || "",
    diffNewText: searchParams?.get("diffNewText") || "",
    flashButton: searchParams?.get("flashButton") || "none",
    mcpTools: searchParams?.get("mcpTools")?.split("\n").filter(Boolean) || [],
  };

  useEffect(() => {
    let dark = false;
    if (config.themeMode === "dark") {
      dark = true;
    } else if (config.themeMode === "light") {
      dark = false;
    } else {
      dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    setIsDark(dark);
    
    // Set dark class on html element for portals (dropdowns, modals)
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [config.themeMode]);

  const primaryColor = isDark ? config.darkColor : config.lightColor;

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
      : "59 130 246";
  };

  const hexToRgba = (hex: string, alpha: number) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(59, 130, 246, ${alpha})`;
  };

  const escapeHtml = (text: string): string => {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
  };

  const highlightMentions = (text: string) => {
    const escaped = escapeHtml(text);
    return escaped.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
  };

  const renderContextPill = (context: string) => {
    let icon = null;
    let usesPrimary = false;
    
    if (context.startsWith("@")) {
      usesPrimary = true;
    } else if (context.startsWith("http")) {
      usesPrimary = true;
      icon = (
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd"/>
        </svg>
      );
    } else if (context.startsWith("#")) {
      usesPrimary = true;
      icon = (
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd"/>
        </svg>
      );
    } else if (context.endsWith("/")) {
      icon = (
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
        </svg>
      );
    } else if (context.includes(".")) {
      icon = (
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4zm2 4a1 1 0 011-1h4a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7zm-1 5a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd"/>
        </svg>
      );
    }

    const pillStyle = usesPrimary ? {
      backgroundColor: hexToRgba(primaryColor, 0.1),
      color: primaryColor,
      border: `1px solid ${hexToRgba(primaryColor, 0.2)}`,
    } : {
      backgroundColor: isDark ? "rgba(38,38,38,0.5)" : "rgba(248,250,252,1)",
      color: isDark ? "#fafafa" : "#0f172a",
      border: isDark ? "1px solid #404040" : "1px solid #e2e8f0",
    };

    return (
      <span 
        key={context} 
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
        style={pillStyle}
      >
        {icon}
        <span>{context.startsWith("#") ? context.substring(1) : context}</span>
      </span>
    );
  };

  const toggleFileSelection = (file: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const allContextPills = [...config.context, ...Array.from(selectedFiles)];

  const fileTree = useMemo(() => buildFileTree(config.filetree), [config.filetree]);

  const renderTreeNode = (node: TreeNode, depth: number = 0): React.ReactNode => {
    const isSelected = selectedFiles.has(node.path);
    return (
      <div key={node.path}>
        <button
          onClick={() => !node.isFolder && toggleFileSelection(node.path)}
          className="w-full flex items-center gap-1.5 py-0.5 text-[10px] rounded transition-colors text-left"
          style={{ 
            paddingLeft: `${depth * 12 + 8}px`, 
            paddingRight: "8px",
            backgroundColor: isSelected ? hexToRgba(primaryColor, 0.1) : "transparent",
            color: isSelected ? primaryColor : (isDark ? "#e5e5e5" : "#374151"),
          }}
        >
          {node.isFolder ? (
            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
            </svg>
          ) : (
            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4z" clipRule="evenodd"/>
            </svg>
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {node.children.length > 0 && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className={cn("h-screen flex", isDark ? "dark" : "")}
      style={{
        ["--primary" as string]: hexToRgb(primaryColor),
        ["--background" as string]: isDark ? "26 26 26" : "255 255 255",
        ["--foreground" as string]: isDark ? "250 250 250" : "15 23 42",
        ["--muted" as string]: isDark ? "38 38 38" : "248 250 252",
        ["--muted-foreground" as string]: isDark ? "163 163 163" : "100 116 139",
        ["--border" as string]: isDark ? "64 64 64" : "226 232 240",
      } as React.CSSProperties}
    >
      <style jsx global>{`
        .mention {
          background-color: rgb(var(--primary) / 0.1);
          color: rgb(var(--primary));
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-weight: 500;
        }
        .bg-primary\\/10 { background-color: rgb(var(--primary) / 0.1); }
        .text-primary { color: rgb(var(--primary)); }
        .border-primary\\/20 { border-color: rgb(var(--primary) / 0.2); }
        .bg-muted { background-color: rgb(var(--muted)); }
        .text-foreground { color: rgb(var(--foreground)); }
        .border-border { border-color: rgb(var(--border)); }
        .text-muted-foreground { color: rgb(var(--muted-foreground)); }
        .bg-background { background-color: rgb(var(--background)); }
      `}</style>

      {/* File Sidebar */}
      {fileTree.length > 0 && (
        <div 
          className="w-40 sm:w-44 border-r flex-shrink-0 overflow-y-auto"
          style={{
            backgroundColor: isDark ? "rgba(38,38,38,0.5)" : "#ffffff",
            borderColor: isDark ? "#404040" : "#e2e8f0",
          }}
        >
          <div 
            className="p-2 border-b"
            style={{ borderColor: isDark ? "#404040" : "#e2e8f0" }}
          >
            <h3 
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: isDark ? "#a3a3a3" : "#64748b" }}
            >
              Files
            </h3>
          </div>
          <div className="py-1">
            {fileTree.map(node => renderTreeNode(node))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div 
        className="flex-1 flex flex-col p-2 sm:p-4 h-full overflow-hidden relative"
        style={{ backgroundColor: isDark ? "#1a1a1a" : "#ffffff" }}
      >
        {/* Large Images (##image or ##image:Label) */}
        {allContextPills.filter(ctx => ctx.startsWith("##image")).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 flex-shrink-0">
            {allContextPills.filter(ctx => ctx.startsWith("##image")).map((ctx, index) => {
              const label = ctx.includes(":") ? ctx.split(":")[1] : `Image ${index + 1}`;
              return (
                <div 
                  key={`${ctx}-${index}`}
                  className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0"
                  style={{ border: `2px solid ${hexToRgba(primaryColor, 0.3)}` }}
                >
                  <img 
                    src={`https://picsum.photos/200?sig=${index}`}
                    alt={label}
                    className="w-full h-full object-cover"
                  />
                  <div 
                    className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[8px] font-medium text-center"
                    style={{
                      backgroundColor: hexToRgba(primaryColor, 0.9),
                      color: "#fff",
                    }}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Context Pills (excluding ##image) */}
        {allContextPills.filter(ctx => !ctx.startsWith("##image")).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 flex-shrink-0">
            {allContextPills.filter(ctx => !ctx.startsWith("##image")).map((ctx) => renderContextPill(ctx))}
          </div>
        )}

        {/* MCP Tools */}
        {config.mcpTools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 flex-shrink-0">
            {config.mcpTools.map((tool) => {
              const [server, toolName] = tool.includes(":") ? tool.split(":") : ["mcp", tool];
              return (
                <span 
                  key={tool}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.1)",
                    color: isDark ? "#a78bfa" : "#7c3aed",
                    border: isDark ? "1px solid rgba(139,92,246,0.3)" : "1px solid rgba(139,92,246,0.2)",
                  }}
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                  </svg>
                  <span className="opacity-60">{server}:</span>
                  <span>{toolName}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Diff View */}
        {config.showDiff && config.diffFilename && (
          <div className={cn(
            "mb-2 flex-shrink-0 bg-muted border border-border rounded-lg p-2 transition-all",
            diffCollapsed && "py-1"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <svg className="w-3 h-3 text-primary flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V7.414A2 2 0 0017.414 6L14 2.586A2 2 0 0012.586 2H4zm2 4a1 1 0 011-1h4a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7zm-1 5a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd"/>
                </svg>
                <span className="text-xs font-medium text-foreground truncate">{config.diffFilename}</span>
              </div>
              <div className="flex gap-1 items-center">
                <div className="flex rounded-md overflow-hidden">
                  <button className={cn(
                    "px-2 py-0.5 bg-green-500 hover:bg-green-600 text-white text-[10px] font-medium transition-colors flex items-center gap-0.5",
                    config.flashButton === "accept" && "animate-pulse"
                  )}>
                    <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                    <span className="hidden sm:inline">Accept</span>
                  </button>
                  <button className={cn(
                    "px-2 py-0.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-medium transition-colors flex items-center gap-0.5",
                    config.flashButton === "reject" && "animate-pulse"
                  )}>
                    <svg className="w-2.5 h-2.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                    <span className="hidden sm:inline">Reject</span>
                  </button>
                </div>
                <button 
                  onClick={() => setDiffCollapsed(!diffCollapsed)}
                  className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className={cn("w-3 h-3 transition-transform", diffCollapsed && "rotate-180")} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
                  </svg>
                </button>
              </div>
            </div>
            {!diffCollapsed && (
              <div className="space-y-1 mt-1.5">
                {config.diffOldText && (
                  <div 
                    className="p-2 rounded text-[10px] font-mono whitespace-pre-wrap max-h-20 overflow-y-auto"
                    style={{
                      backgroundColor: isDark ? "rgba(127, 29, 29, 0.15)" : "rgba(254, 226, 226, 0.6)",
                      color: isDark ? "#fca5a5" : "#b91c1c",
                      border: isDark ? "1px solid rgba(127, 29, 29, 0.3)" : "1px solid rgba(252, 165, 165, 0.5)",
                    }}
                  >
                    {config.diffOldText}
                  </div>
                )}
                {config.diffNewText && (
                  <div 
                    className="p-2 rounded text-[10px] font-mono whitespace-pre-wrap max-h-20 overflow-y-auto"
                    style={{
                      backgroundColor: isDark ? "rgba(20, 83, 45, 0.15)" : "rgba(220, 252, 231, 0.6)",
                      color: isDark ? "#86efac" : "#15803d",
                      border: isDark ? "1px solid rgba(20, 83, 45, 0.3)" : "1px solid rgba(134, 239, 172, 0.5)",
                    }}
                  >
                    {config.diffNewText}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Prompt Container */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <div 
            className="h-full rounded-lg p-3 sm:p-4 overflow-y-auto"
            style={{
              backgroundColor: isDark ? "rgba(38,38,38,0.5)" : "rgba(241,245,249,0.5)",
              border: isDark ? "1px solid #404040" : "1px solid #e2e8f0",
            }}
          >
            {config.prompt ? (
              <p
                className="text-sm whitespace-pre-wrap"
                style={{ color: isDark ? "#fafafa" : "#0f172a" }}
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(highlightMentions(config.prompt), {
                    ALLOWED_TAGS: ['span'],
                    ALLOWED_ATTR: ['class'],
                  }),
                }}
              />
            ) : (
              <p 
                className="text-sm italic"
                style={{ color: isDark ? "#a3a3a3" : "#64748b" }}
              >
                Enter your prompt in the designer...
              </p>
            )}
          </div>
        </div>

        {/* Settings Pills + Run Button */}
        <div className="flex items-center justify-between mt-2 flex-shrink-0">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: hexToRgba(primaryColor, 0.1),
                color: primaryColor,
                border: `1px solid ${hexToRgba(primaryColor, 0.2)}`,
              }}
            >
              {config.mode.charAt(0).toUpperCase() + config.mode.slice(1)}
            </span>
            <span 
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{
                backgroundColor: hexToRgba(primaryColor, 0.1),
                color: primaryColor,
                border: `1px solid ${hexToRgba(primaryColor, 0.2)}`,
              }}
            >
              {config.model}
            </span>
            {(config.thinking || config.reasoning || config.planning || config.fast || config.max) && (
              <span style={{ color: isDark ? "#a3a3a3" : "#64748b" }} className="text-[10px]">•</span>
            )}
            {config.thinking && (
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: isDark ? "#262626" : "#f8fafc",
                  color: isDark ? "#fafafa" : "#0f172a",
                  border: isDark ? "1px solid #404040" : "1px solid #e2e8f0",
                }}
              >
                Thinking
              </span>
            )}
            {config.reasoning && (
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: isDark ? "#262626" : "#f8fafc",
                  color: isDark ? "#fafafa" : "#0f172a",
                  border: isDark ? "1px solid #404040" : "1px solid #e2e8f0",
                }}
              >
                Reasoning
              </span>
            )}
            {config.planning && (
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: isDark ? "#262626" : "#f8fafc",
                  color: isDark ? "#fafafa" : "#0f172a",
                  border: isDark ? "1px solid #404040" : "1px solid #e2e8f0",
                }}
              >
                Planning
              </span>
            )}
            {config.fast && (
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: isDark ? "#262626" : "#f8fafc",
                  color: isDark ? "#fafafa" : "#0f172a",
                  border: isDark ? "1px solid #404040" : "1px solid #e2e8f0",
                }}
              >
                Fast
              </span>
            )}
            {config.max && (
              <span 
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{
                  backgroundColor: isDark ? "#262626" : "#f8fafc",
                  color: isDark ? "#fafafa" : "#0f172a",
                  border: isDark ? "1px solid #404040" : "1px solid #e2e8f0",
                }}
              >
                Max
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="https://prompts.chat" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[10px] font-medium transition-opacity hover:opacity-80"
              style={{ color: isDark ? "#a3a3a3" : "#64748b" }}
            >
              <img 
                src={isDark ? "/logo-dark.svg" : "/logo.svg"} 
                alt="prompts.chat" 
                className="w-3.5 h-3.5"
              />
              <span>prompts.chat</span>
            </a>
            {config.prompt && (
              <div className={isDark ? "dark" : ""}>
                <RunPromptButton
                  content={config.prompt}
                  variant="outline"
                  size="icon"
                  className={`!h-6 !w-6 !p-0 [&_svg]:!h-3 [&_svg]:!w-3 ${isDark ? "!border-zinc-600 !bg-zinc-800 !text-zinc-200" : "!border-zinc-300 !bg-white !text-zinc-700"}`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
      <EmbedContent />
    </Suspense>
  );
}
