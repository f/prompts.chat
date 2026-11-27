"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { ChevronDown, Play, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import Editor from "@monaco-editor/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SQL_EXAMPLES from "@/data/sql-examples.json";
import { HF_DATASET_URL, HF_LISTING_QUERIES, hfQueryUrl, type HFListingType } from "@/lib/hf-data-studio";

interface HFDataStudioDropdownProps {
  aiGenerationEnabled?: boolean;
  /** Opens with a query for this listing's items instead of the prompt examples */
  listing?: HFListingType;
}

export function HFDataStudioDropdown({ aiGenerationEnabled = false, listing }: HFDataStudioDropdownProps) {
  const t = useTranslations("prompts.hfDataStudio");
  const { resolvedTheme } = useTheme();
  const listingSql = listing ? HF_LISTING_QUERIES[listing] : undefined;
  const examples = listing && listingSql
    ? [{ label: t(`listingQuery.${listing}`), sql: listingSql }, ...SQL_EXAMPLES]
    : SQL_EXAMPLES;
  const [sql, setSql] = useState(examples[0].sql);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);

  const handleOpenDataset = () => {
    window.open(listingSql ? hfQueryUrl(listingSql) : HF_DATASET_URL, "_blank");
  };

  const handleRun = () => {
    window.open(hfQueryUrl(sql), "_blank");
  };

  const handleGenerateSQL = async () => {
    if (!aiPrompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    try {
      const response = await fetch("/api/generate/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      
      if (!response.ok) throw new Error("Failed to generate SQL");
      
      const data = await response.json();
      setSql(data.sql);
    } catch (error) {
      console.error("SQL generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex w-full sm:w-auto">
      <Button 
        size="sm" 
        variant="outline" 
        className="h-8 text-xs rounded-e-none border-e-0 flex-1 sm:flex-initial"
        onClick={handleOpenDataset}
      >
        🤗 {t("button")}
      </Button>
      <Popover modal>
        <PopoverTrigger asChild>
          <Button 
            size="sm" 
            variant="outline" 
            className="h-8 px-2 rounded-s-none"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[calc(100vw-2rem)] sm:w-[500px] p-3" sideOffset={8} collisionPadding={16}>
          <div className="space-y-3">
            {/* Header with Examples Select + AI Button */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-1 items-stretch">
                <Select onValueChange={(value) => setSql(value)}>
                  <SelectTrigger className={`h-8 text-xs flex-1 ${aiGenerationEnabled ? "rounded-e-none border-e-0" : ""}`} size="sm">
                    <SelectValue placeholder={t("selectExample")} />
                  </SelectTrigger>
                  <SelectContent>
                    {examples.map((example, index) => (
                      <SelectItem key={index} value={example.sql} className="text-xs">
                        {example.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {aiGenerationEnabled && (
                  <Button
                    size="sm"
                    variant={showAiInput ? "secondary" : "outline"}
                    className="rounded-s-none border-s-0"
                    onClick={() => setShowAiInput(!showAiInput)}
                    title={t("aiGenerate")}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <a
                href={HF_DATASET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
              >
                {t("openDataset")} <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* AI Input (toggled) */}
            {aiGenerationEnabled && showAiInput && (
              <div className="flex rounded-md focus-within:ring-1 focus-within:ring-ring focus-within:border-foreground/30">
                <input
                  placeholder={t("aiPlaceholder")}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGenerateSQL()}
                  className="h-8 text-xs flex-1 rounded-s-md rounded-e-none border border-e-0 border-input bg-transparent px-3 py-1 outline-none placeholder:text-muted-foreground"
                  autoFocus
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  className="rounded-s-none border-s-0 text-[11px] bg-muted/50 hover:bg-muted"
                  onClick={handleGenerateSQL}
                  disabled={isGenerating || !aiPrompt.trim()}
                >
                  {isGenerating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    t("generateSql")
                  )}
                </Button>
              </div>
            )}

            {/* SQL Editor */}
            <div dir="ltr" className="border rounded-md overflow-hidden text-left">
              <Editor
                height="200px"
                defaultLanguage="sql"
                value={sql}
                onChange={(value) => setSql(value || "")}
                theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: "on",
                }}
              />
            </div>

            {/* Run Button */}
            <Button size="sm" className="w-full" onClick={handleRun}>
              <Play className="h-3.5 w-3.5 mr-1.5" />
              {t("runQuery")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
