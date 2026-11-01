"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { PromptIde } from "@/components/ide/prompt-ide";
import { PromptEnhancer } from "@/components/developers/prompt-enhancer";
import { EmbedDesigner } from "@/components/developers/embed-designer";
import { PromptTokenizer } from "@/components/developers/prompt-tokenizer";
import { Monitor, Code2, Sparkles, Frame, Hash } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ALL_TABS = ["enhancer", "tokenizer", "builder", "embed"] as const;
type TabValue = (typeof ALL_TABS)[number];

interface DevelopersToolsProps {
  promptEnhancerEnabled: boolean;
}

export function DevelopersTools({ promptEnhancerEnabled }: DevelopersToolsProps) {
  const t = useTranslations("developers");
  const validTabs = useMemo<readonly TabValue[]>(
    () => ALL_TABS.filter((tab) => tab !== "enhancer" || promptEnhancerEnabled),
    [promptEnhancerEnabled]
  );
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>(validTabs[0]);

  // Read hash from URL on mount and hash changes
  const updateTabFromHash = useCallback(() => {
    const hash = window.location.hash.replace("#", "");
    if (validTabs.includes(hash as TabValue)) {
      setActiveTab(hash as TabValue);
    }
  }, [validTabs]);

  useEffect(() => {
    setMounted(true);
    
    // Check mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Read initial hash
    updateTabFromHash();

    // Listen for hash changes
    window.addEventListener("hashchange", updateTabFromHash);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("hashchange", updateTabFromHash);
    };
  }, [updateTabFromHash]);

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value as TabValue);
    window.history.replaceState(null, "", `#${value}`);
  };

  if (!mounted) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="container flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Monitor className="h-16 w-16 text-muted-foreground mb-6" />
        <h1 className="text-2xl font-bold mb-2">{t("desktopOnly")}</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          {t("desktopOnlyDescription")}
        </p>
        <Button asChild>
          <Link href="/prompts">{t("browsePrompts")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-1.65rem)] overflow-hidden">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col h-full gap-0 overflow-hidden">
        <div className="h-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 shrink-0 flex items-center">
          <TabsList className="h-9 bg-transparent border-0 p-0 gap-2">
            {promptEnhancerEnabled && (
              <TabsTrigger 
                value="enhancer" 
                className="h-9 border-0 border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none rounded-none px-3 py-2 gap-1.5 text-sm"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t("promptEnhancer")}
              </TabsTrigger>
            )}
            <TabsTrigger 
              value="tokenizer" 
              className="h-9 border-0 border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none rounded-none px-3 py-2 gap-1.5 text-sm"
            >
              <Hash className="h-3.5 w-3.5" />
              {t("promptTokenizer")}
            </TabsTrigger>
            <TabsTrigger 
              value="builder" 
              className="h-9 border-0 border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none rounded-none px-3 py-2 gap-1.5 text-sm"
            >
              <Code2 className="h-3.5 w-3.5" />
              {t("promptBuilder")}
            </TabsTrigger>
            <TabsTrigger 
              value="embed" 
              className="h-9 border-0 border-b-2 border-b-transparent data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none rounded-none px-3 py-2 gap-1.5 text-sm"
            >
              <Frame className="h-3.5 w-3.5" />
              {t("embedDesigner")}
            </TabsTrigger>
          </TabsList>
        </div>
        
        {promptEnhancerEnabled && (
          <TabsContent value="enhancer" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
            <PromptEnhancer />
          </TabsContent>
        )}
        
        <TabsContent value="tokenizer" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <PromptTokenizer />
        </TabsContent>
        
        <TabsContent value="builder" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <PromptIde />
        </TabsContent>
        
        <TabsContent value="embed" className="flex-1 mt-0 min-h-0 overflow-hidden data-[state=inactive]:hidden">
          <EmbedDesigner />
        </TabsContent>
      </Tabs>
    </div>
  );
}
