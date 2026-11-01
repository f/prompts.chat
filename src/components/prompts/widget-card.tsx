"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RunPromptButton } from "@/components/prompts/run-prompt-button";
import { analyticsWidget } from "@/lib/analytics";
import type { InjectedWidget } from "@/lib/plugins/widgets";
import { cn } from "@/lib/utils";

export interface WidgetCardProps {
  prompt: InjectedWidget;
  /** "compact" leaves out the content preview to match bot and team cards. Default: "prompt" */
  variant?: "prompt" | "compact";
}

export function WidgetCard({ prompt, variant = "prompt" }: WidgetCardProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const isCompact = variant === "compact";

  // If widget has a custom render function, use it
  if (prompt.render) {
    return <>{prompt.render(prompt.instanceIndex, "prompts")}</>;
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(prompt.content);
    setCopied(true);
    toast.success(tCommon("copiedToClipboard"));
    analyticsWidget.copy(prompt.id, prompt.actionLabel || prompt.sponsor?.name);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleActionClick = () => {
    analyticsWidget.action(prompt.id, prompt.actionLabel || prompt.sponsor?.name, prompt.actionUrl);
  };

  return (
    <div
      className={cn(
        "group border rounded-[var(--radius)] overflow-hidden hover:border-foreground/20 transition-colors flex flex-col p-4",
        isCompact ? "h-full min-w-0 bg-card" : "bg-gradient-to-br from-background to-muted/30"
      )}
    >
      {/* Sponsor Header */}
      {prompt.sponsor && (
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-dashed">
          <Link
            href={prompt.sponsor.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            {prompt.sponsor.logoDark ? (
              <>
                <Image
                  src={prompt.sponsor.logo}
                  alt={prompt.sponsor.name}
                  width={80}
                  height={20}
                  className="h-5 w-auto dark:hidden"
                />
                <Image
                  src={prompt.sponsor.logoDark}
                  alt={prompt.sponsor.name}
                  width={80}
                  height={20}
                  className="h-5 w-auto hidden dark:block"
                />
              </>
            ) : (
              <Image
                src={prompt.sponsor.logo}
                alt={prompt.sponsor.name}
                width={80}
                height={20}
                className="h-5 w-auto"
              />
            )}
          </Link>
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Sponsored
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="font-medium text-sm line-clamp-1">
            {prompt.title}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {t(`types.${prompt.type.toLowerCase()}`)}
        </Badge>
      </div>

      {/* Description */}
      {prompt.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {prompt.description}
        </p>
      )}

      {/* Content Preview */}
      {!isCompact && (
        <div className="relative flex-1 mb-3 min-h-0">
          <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-y-auto font-mono whitespace-pre-wrap break-words max-h-48">
            {prompt.content}
          </pre>
        </div>
      )}

      {/* Tags */}
      {prompt.tags && prompt.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {prompt.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t mt-auto">
        <div className="flex items-center gap-1.5">
          {prompt.sponsor && (
            <Link
              href={prompt.sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <span>by {prompt.sponsor.name}</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          {prompt.content && (
            <button
              onClick={copyToClipboard}
              className="p-1 rounded hover:bg-accent"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          {prompt.actionUrl ? (
            <Link
              href={prompt.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center"
              title={prompt.actionLabel || "Try it"}
              onClick={handleActionClick}
            >
              <Play className="h-4 w-4" />
            </Link>
          ) : (
            <RunPromptButton
              content={prompt.content}
              title={prompt.title}
              description={prompt.description}
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              categoryName={prompt.category}
              promptType={prompt.type}
            />
          )}
        </div>
      </div>
    </div>
  );
}
