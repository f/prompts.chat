"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analyticsMcp } from "@/lib/analytics";
import {
  MCP_CLIENTS,
  MCP_CLIENT_LABELS,
  MCP_NPM_PACKAGE,
  buildLocalEnv,
  getMcpClientConfig,
  type McpClient,
  type McpMode,
} from "@/lib/mcp/client-config";
import { McpClientLogo } from "./mcp-client-logo";

const API_KEY_PLACEHOLDER = "<click to reveal>";

interface McpConfigTabsProps {
  baseUrl?: string;
  /** URL parameters to append (e.g., users, categories, tags) */
  queryParams?: string;
  className?: string;
  /** External mode control */
  mode?: "remote" | "local";
  onModeChange?: (mode: "remote" | "local") => void;
  /** Hide the mode toggle (when controlled externally) */
  hideModeToggle?: boolean;
  /** API key for authenticated access */
  apiKey?: string | null;
  /** Show official prompts.chat branding (VS Code buttons, registry mention) */
  showOfficialBranding?: boolean;
}

export function McpConfigTabs({ baseUrl, queryParams, className, mode, onModeChange, hideModeToggle, apiKey, showOfficialBranding = false }: McpConfigTabsProps) {
  const t = useTranslations("mcp");
  const [selectedClient, setSelectedClient] = useState<McpClient>("claude-code");
  const [internalMode, setInternalMode] = useState<McpMode>("remote");
  const [copied, setCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const selectedMode = mode ?? internalMode;
  const handleModeChange = (newMode: McpMode) => {
    if (onModeChange) {
      onModeChange(newMode);
    } else {
      setInternalMode(newMode);
    }
  };

  const base = baseUrl || (typeof window !== "undefined" ? window.location.origin : "https://prompts.chat");
  const mcpUrl = queryParams ? `${base}/api/mcp?${queryParams}` : `${base}/api/mcp`;
  
  // Full config with actual API key (for copying)
  const config = getMcpClientConfig(selectedClient, selectedMode, { mcpUrl, apiKey, queryParams });
  
  // Display config: show full key if revealed, otherwise show placeholder (queryParams always visible)
  const displayApiKey = apiKey 
    ? (showApiKey ? apiKey : API_KEY_PLACEHOLDER)
    : null;
  const displayConfig = getMcpClientConfig(selectedClient, selectedMode, { mcpUrl, apiKey: displayApiKey, queryParams }).code;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(config.code);
    analyticsMcp.copyCommand(`${selectedClient}-${selectedMode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Client Tabs */}
      <div className="flex gap-0.5 overflow-x-auto" role="tablist">
        {MCP_CLIENTS.map((client) => (
          <button
            key={client}
            role="tab"
            aria-selected={selectedClient === client}
            onClick={() => setSelectedClient(client)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap",
              selectedClient === client
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <McpClientLogo client={client} className="h-3 w-3" />
            {MCP_CLIENT_LABELS[client]}
          </button>
        ))}
      </div>

      {/* Mode Toggle - only show if not hidden */}
      {!hideModeToggle && (
        <div className="flex gap-0.5">
          <button
            onClick={() => handleModeChange("remote")}
            className={cn(
              "px-2 py-1 text-[11px] font-medium rounded transition-colors",
              selectedMode === "remote"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Remote
          </button>
          <button
            onClick={() => handleModeChange("local")}
            className={cn(
              "px-2 py-1 text-[11px] font-medium rounded transition-colors",
              selectedMode === "local"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Local
          </button>
        </div>
      )}

      {/* Config Display */}
      <div className="relative">
        <div 
          dir="ltr" 
          className={cn(
            "bg-muted rounded-md p-2 font-mono text-[11px] overflow-x-auto text-left",
            showOfficialBranding && (selectedClient === "vscode" || selectedClient === "cursor") && "max-h-24 overflow-y-auto"
          )}
        >
          <pre className="whitespace-pre">
            {apiKey && !showApiKey ? (
              <>
                {displayConfig.split(API_KEY_PLACEHOLDER).map((part, i, arr) => (
                  <span key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span 
                        onClick={() => setShowApiKey(true)}
                        className="text-primary underline cursor-pointer hover:text-primary/80"
                      >
                        {API_KEY_PLACEHOLDER}
                      </span>
                    )}
                  </span>
                ))}
              </>
            ) : (
              displayConfig
            )}
          </pre>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-1 right-1 h-6 w-6 p-0"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {(config.note || config.omitsApiKey) && (
        <p className="text-[10px] text-muted-foreground">
          {config.note && t(`clientNotes.${config.note}`)}
          {config.note && config.omitsApiKey && " "}
          {config.omitsApiKey && t("clientNotes.urlOnlyApiKey")}
        </p>
      )}

      {/* Cursor Install Button - only for official branding */}
      {showOfficialBranding && selectedClient === "cursor" && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5 w-fit"
            onClick={() => {
              const cursorConfig: Record<string, unknown> = {
                command: "npx",
                args: ["-y", MCP_NPM_PACKAGE],
              };
              const localEnv = buildLocalEnv(apiKey, queryParams);
              if (localEnv) cursorConfig.env = localEnv;
              const configBase64 = btoa(JSON.stringify(cursorConfig));
              window.open(`cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent("prompts.chat")}&config=${configBase64}`, "_self");
            }}
          >
            <McpClientLogo client="cursor" className="h-3.5 w-3.5" />
            Cursor
          </Button>
        </div>
      )}

      {/* VS Code Install Buttons - only for official branding */}
      {showOfficialBranding && selectedClient === "vscode" && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => window.open("vscode:mcp/by-name/io.github.f/prompts.chat-mcp", "_self")}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#007ACC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              VS Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => window.open("vscode-insiders:mcp/by-name/io.github.f/prompts.chat-mcp", "_self")}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="#24bfa5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Insiders
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            prompts.chat is in the official{" "}
            <a
              href="https://github.com/mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GitHub MCP Registry
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
