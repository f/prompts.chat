"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FolderTree, Tags, FileText, Bot, Webhook, Flag, UsersRound } from "lucide-react";

const VALID_TABS = ["users", "categories", "tags", "webhooks", "prompts", "bots", "teams", "reports"] as const;
type TabValue = (typeof VALID_TABS)[number];

interface AdminTabsProps {
  translations: {
    users: string;
    categories: string;
    tags: string;
    webhooks: string;
    prompts: string;
    bots: string;
    teams: string;
    reports: string;
  };
  pendingReportsCount: number;
  children: {
    users: React.ReactNode;
    categories: React.ReactNode;
    tags: React.ReactNode;
    webhooks: React.ReactNode;
    prompts: React.ReactNode;
    bots: React.ReactNode;
    teams: React.ReactNode;
    reports: React.ReactNode;
  };
}

export function AdminTabs({ translations, pendingReportsCount, children }: AdminTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>("users");
  const [mounted, setMounted] = useState(false);

  const updateTabFromHash = useCallback(() => {
    const hash = window.location.hash.replace("#", "");
    if (VALID_TABS.includes(hash as TabValue)) {
      setActiveTab(hash as TabValue);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    updateTabFromHash();
    window.addEventListener("hashchange", updateTabFromHash);
    return () => {
      window.removeEventListener("hashchange", updateTabFromHash);
    };
  }, [updateTabFromHash]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    window.history.replaceState(null, "", `#${value}`);
  };

  if (!mounted) {
    return null;
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <TabsList className="w-max sm:w-auto">
          <TabsTrigger value="users" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{translations.users}</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3">
            <FolderTree className="h-4 w-4" />
            <span className="hidden sm:inline">{translations.categories}</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3">
            <Tags className="h-4 w-4" />
            <span className="hidden sm:inline">{translations.tags}</span>
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3">
            <Webhook className="h-4 w-4" />
            <span className="hidden sm:inline">{translations.webhooks}</span>
          </TabsTrigger>
          <TabsTrigger value="prompts" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{translations.prompts}</span>
          </TabsTrigger>
          <TabsTrigger value="bots" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3">
            <Bot className="h-4 w-4" />
            <span className="hidden sm:inline">{translations.bots}</span>
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3">
            <UsersRound className="h-4 w-4" />
            <span className="hidden sm:inline">{translations.teams}</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5 sm:gap-2 px-2.5 sm:px-3">
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">{translations.reports}</span>
            {pendingReportsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-destructive text-white rounded-full">
                {pendingReportsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="users">{children.users}</TabsContent>
      <TabsContent value="categories">{children.categories}</TabsContent>
      <TabsContent value="tags">{children.tags}</TabsContent>
      <TabsContent value="webhooks">{children.webhooks}</TabsContent>
      <TabsContent value="prompts">{children.prompts}</TabsContent>
      <TabsContent value="bots">{children.bots}</TabsContent>
      <TabsContent value="teams">{children.teams}</TabsContent>
      <TabsContent value="reports">{children.reports}</TabsContent>
    </Tabs>
  );
}
