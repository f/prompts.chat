"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface DiffViewProps {
  original: string;
  modified: string;
  className?: string;
  mode?: "line" | "word" | "inline";
  language?: "json" | "yaml" | null;
}

interface WordDiff {
  type: "unchanged" | "added" | "removed";
  text: string;
}

// Word-by-word diff using LCS algorithm
function computeWordDiff(original: string, modified: string): WordDiff[] {
  // Tokenize into words while preserving whitespace/newlines
  const tokenize = (str: string): string[] => {
    const tokens: string[] = [];
    let current = "";
    
    for (const char of str) {
      if (/\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = "";
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  };

  const originalTokens = tokenize(original);
  const modifiedTokens = tokenize(modified);

  // Compute LCS
  const m = originalTokens.length;
  const n = modifiedTokens.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalTokens[i - 1] === modifiedTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const result: WordDiff[] = [];
  let i = m, j = n;
  const temp: WordDiff[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalTokens[i - 1] === modifiedTokens[j - 1]) {
      temp.push({ type: "unchanged", text: originalTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: "added", text: modifiedTokens[j - 1] });
      j--;
    } else if (i > 0) {
      temp.push({ type: "removed", text: originalTokens[i - 1] });
      i--;
    }
  }

  // Reverse and merge consecutive same-type diffs
  for (let k = temp.length - 1; k >= 0; k--) {
    const item = temp[k];
    const last = result[result.length - 1];
    if (last && last.type === item.type) {
      last.text += item.text;
    } else {
      result.push({ ...item });
    }
  }

  return result;
}

export function DiffView({ original, modified, className, mode = "word", language }: DiffViewProps) {
  const t = useTranslations("diff");
  const isCode = !!language;
  const wordDiff = useMemo(() => computeWordDiff(original, modified), [original, modified]);

  const stats = useMemo(() => {
    let additions = 0;
    let deletions = 0;
    // Estimate tokens: ~4 characters per token (common approximation for LLM tokenizers)
    const estimateTokens = (text: string) => Math.ceil(text.replace(/\s/g, "").length / 4);
    wordDiff.forEach((item) => {
      if (item.type === "added") additions += estimateTokens(item.text);
      if (item.type === "removed") deletions += estimateTokens(item.text);
    });
    return { additions, deletions };
  }, [wordDiff]);

  const hasChanges = stats.additions > 0 || stats.deletions > 0;

  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* Stats header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b text-xs">
        <div className="flex items-center gap-3">
          {hasChanges ? (
            <>
              <span className="text-green-600 dark:text-green-400 font-medium">≈+{stats.additions} {t("tokens")}</span>
              <span className="text-red-600 dark:text-red-400 font-medium">≈-{stats.deletions} {t("tokens")}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{t("noChanges")}</span>
          )}
        </div>
      </div>
      
      {/* Diff content - inline word diff */}
      {isCode ? (
        <CodeDiffContent wordDiff={wordDiff} language={language} />
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-300px)] p-3 text-sm font-mono whitespace-pre-wrap break-words">
          {wordDiff.map((item, idx) => (
            <span
              key={idx}
              className={cn(
                item.type === "added" && "bg-green-500/20 text-green-700 dark:text-green-300",
                item.type === "removed" && "bg-red-500/20 text-red-700 dark:text-red-300 line-through"
              )}
            >
              {item.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Code diff content with line numbers
function CodeDiffContent({ wordDiff, language }: { wordDiff: WordDiff[]; language: "json" | "yaml" }) {
  // Build combined text with diff markers
  const lines = useMemo(() => {
    const combined = wordDiff.map(d => d.text).join("");
    const lineTexts = combined.split("\n");
    
    // Track which lines have changes
    let charIndex = 0;
    const lineInfo: Array<{ text: string; hasAddition: boolean; hasDeletion: boolean }> = [];
    
    for (const lineText of lineTexts) {
      let hasAddition = false;
      let hasDeletion = false;
      
      // Check what diffs overlap with this line
      const lineStart = charIndex;
      const lineEnd = charIndex + lineText.length;
      
      let pos = 0;
      for (const diff of wordDiff) {
        const diffStart = pos;
        const diffEnd = pos + diff.text.length;
        
        // Check if diff overlaps with this line
        if (diffEnd > lineStart && diffStart < lineEnd + 1) {
          if (diff.type === "added") hasAddition = true;
          if (diff.type === "removed") hasDeletion = true;
        }
        pos = diffEnd;
      }
      
      lineInfo.push({ text: lineText, hasAddition, hasDeletion });
      charIndex = lineEnd + 1; // +1 for newline
    }
    
    return lineInfo;
  }, [wordDiff]);

  return (
    <div className="overflow-auto max-h-[calc(100vh-300px)] text-xs font-mono">
      {lines.map((line, i) => (
        <div 
          key={i} 
          className={cn(
            "flex",
            line.hasAddition && !line.hasDeletion && "bg-green-500/10",
            line.hasDeletion && !line.hasAddition && "bg-red-500/10",
            line.hasAddition && line.hasDeletion && "bg-yellow-500/10"
          )}
        >
          <span className="select-none text-muted-foreground/50 w-8 text-right pr-2 py-0.5 shrink-0 border-r bg-muted/30">
            {i + 1}
          </span>
          <span className={cn(
            "w-4 text-center py-0.5 shrink-0",
            line.hasAddition && "text-green-600 dark:text-green-400",
            line.hasDeletion && "text-red-600 dark:text-red-400"
          )}>
            {line.hasAddition && line.hasDeletion ? "~" : line.hasAddition ? "+" : line.hasDeletion ? "-" : " "}
          </span>
          <pre className="flex-1 py-0.5 px-2 whitespace-pre-wrap break-all">
            {line.text || " "}
          </pre>
        </div>
      ))}
    </div>
  );
}

// Side by side diff view
export function SideBySideDiff({ original, modified, className }: Omit<DiffViewProps, "mode">) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 bg-red-500/10 border-b text-xs font-medium text-red-600 dark:text-red-400">
          Original
        </div>
        <div className="p-3 text-sm font-mono whitespace-pre-wrap break-words max-h-[calc(100vh-300px)] overflow-auto">
          {original}
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <div className="px-3 py-1.5 bg-green-500/10 border-b text-xs font-medium text-green-600 dark:text-green-400">
          Modified
        </div>
        <div className="p-3 text-sm font-mono whitespace-pre-wrap break-words max-h-[calc(100vh-300px)] overflow-auto">
          {modified}
        </div>
      </div>
    </div>
  );
}
