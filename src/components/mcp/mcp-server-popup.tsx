"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus, X, ChevronDown, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { McpConfigTabs } from "./mcp-config-tabs";
import { analyticsMcp } from "@/lib/analytics";

// MCP Logo component - shows dark version in dark mode
export function McpIcon({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/mcp.svg"
        alt="MCP"
        className={cn(className, "dark:hidden")}
      />
      <img
        src="/mcp-dark.svg"
        alt="MCP"
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
}

interface McpServerPopupProps {
  /** Pre-filled users (usernames) */
  initialUsers?: string[];
  /** Pre-filled categories (slugs) */
  initialCategories?: string[];
  /** Pre-filled tags (slugs) */
  initialTags?: string[];
  /** Base URL override */
  baseUrl?: string;
  /** Show official prompts.chat branding (VS Code buttons, registry mention) */
  showOfficialBranding?: boolean;
  /**
   * The listing the popup is opened from. The server serves every resource from one URL, and
   * its users/categories/tags filters only narrow prompts, so other listings hide them.
   */
  resource?: McpResource;
}

export type McpResource = "prompts" | "skills" | "bots" | "teams";

export function McpServerPopup({
  initialUsers = [],
  initialCategories = [],
  initialTags = [],
  baseUrl,
  showOfficialBranding = false,
  resource = "prompts",
}: McpServerPopupProps) {
  const t = useTranslations("mcp");
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mcpMode, setMcpMode] = useState<"remote" | "local">("remote");
  const [users, setUsers] = useState<string[]>(initialUsers);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [userInput, setUserInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Fetch API key only when popup is opened and user is logged in
  useEffect(() => {
    if (isOpen && session?.user && !apiKey) {
      fetch("/api/user/api-key")
        .then((res) => res.json())
        .then((data) => {
          if (data.apiKey) {
            setApiKey(data.apiKey);
          }
        })
        .catch(() => {
          // Ignore errors
        });
    }
  }, [isOpen, session?.user, apiKey]);

  // Build query params for MCP URL
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    
    if (users.length > 0) {
      params.set("users", users.join(","));
    }
    if (categories.length > 0) {
      params.set("categories", categories.join(","));
    }
    if (tags.length > 0) {
      params.set("tags", tags.join(","));
    }

    return params.toString();
  }, [users, categories, tags]);

  const addUser = () => {
    const value = userInput.trim().replace(/^@/, "");
    if (value && !users.includes(value)) {
      setUsers([...users, value]);
      setUserInput("");
    }
  };

  const addCategory = () => {
    const value = categoryInput.trim().toLowerCase();
    if (value && !categories.includes(value)) {
      setCategories([...categories, value]);
      setCategoryInput("");
    }
  };

  const addTag = () => {
    const value = tagInput.trim().toLowerCase();
    if (value && !tags.includes(value)) {
      setTags([...tags, value]);
      setTagInput("");
    }
  };

  const removeUser = (user: string) => setUsers(users.filter((u) => u !== user));
  const removeCategory = (cat: string) => setCategories(categories.filter((c) => c !== cat));
  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  return (
    <Popover modal open={isOpen} onOpenChange={(open) => {
        if (open) analyticsMcp.openPopup();
        setIsOpen(open);
      }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <McpIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t("button")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-[480px] p-3" sideOffset={8} collisionPadding={16}>
        <div className="space-y-2">
          {/* Header with Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <McpIcon className="h-4 w-4" />
              <h3 className="font-semibold text-sm">{t("title")}</h3>
            </div>
            <div className="flex gap-0.5">
              <button
                onClick={() => setMcpMode("remote")}
                className={cn(
                  "px-2 py-1 text-[11px] font-medium rounded transition-colors",
                  mcpMode === "remote"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Remote
              </button>
              <button
                onClick={() => setMcpMode("local")}
                className={cn(
                  "px-2 py-1 text-[11px] font-medium rounded transition-colors",
                  mcpMode === "local"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Local
              </button>
            </div>
          </div>

          {/* Description */}
          <p className="text-[11px] text-muted-foreground">
            {t("description")}
          </p>

          {/* Config Tabs */}
          <McpConfigTabs baseUrl={baseUrl} queryParams={queryParams || undefined} mode={mcpMode} hideModeToggle apiKey={apiKey} showOfficialBranding={showOfficialBranding} />

          {/* API Key Link */}
          {session?.user && !apiKey && (
            <Link 
              href="/settings" 
              className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
            >
              <Key className="h-3 w-3" />
              {t("generateApiKey")}
            </Link>
          )}

          {resource !== "prompts" && (
            <p className="border-t pt-2 text-[11px] text-muted-foreground">
              {t(`resourceHint.${resource}`)}
            </p>
          )}

          {/* Collapsible Filters */}
          {resource === "prompts" && (
            <div className="border-t pt-2">
              <button
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="flex items-center justify-between w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>{t("customizeFilters")}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
              </button>
              
              {filtersOpen && (
                <div className="space-y-2 mt-2">
                  {/* Users */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium">{t("users")}</label>
                    <div className="flex gap-1">
                      <Input
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addUser()}
                        placeholder={t("userPlaceholder")}
                        className="h-6 text-[11px] flex-1"
                      />
                      <Button size="sm" variant="outline" className="h-6 px-1.5" onClick={addUser}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {users.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {users.map((user) => (
                          <Badge key={user} variant="secondary" className="text-[10px] gap-0.5 pr-0.5 h-5">
                            @{user}
                            <button onClick={() => removeUser(user)} className="hover:text-destructive">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Categories */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium">{t("categories")}</label>
                    <div className="flex gap-1">
                      <Input
                        value={categoryInput}
                        onChange={(e) => setCategoryInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCategory()}
                        placeholder={t("categoryPlaceholder")}
                        className="h-6 text-[11px] flex-1"
                      />
                      <Button size="sm" variant="outline" className="h-6 px-1.5" onClick={addCategory}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {categories.map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-[10px] gap-0.5 pr-0.5 h-5">
                            {cat}
                            <button onClick={() => removeCategory(cat)} className="hover:text-destructive">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium">{t("tags")}</label>
                    <div className="flex gap-1">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addTag()}
                        placeholder={t("tagPlaceholder")}
                        className="h-6 text-[11px] flex-1"
                      />
                      <Button size="sm" variant="outline" className="h-6 px-1.5" onClick={addTag}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] gap-0.5 pr-0.5 h-5">
                            {tag}
                            <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
