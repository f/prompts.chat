"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Code, Link, Share2 } from "lucide-react";
import { toast } from "sonner";
import { analyticsPrompt } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Simple X/Twitter icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Hacker News icon
function HackerNewsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M0 0v24h24V0H0zm12.3 13.27V18.5h-.8v-5.23L7.7 6.5h.9l3.1 5.37 3.1-5.37h.9l-3.4 6.77z" />
    </svg>
  );
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Embed page already renders `?prompt=`. No extra backend. */
export function buildEmbedUrl(origin: string, prompt: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/embed?prompt=${encodeURIComponent(prompt)}`;
}

export function buildEmbedSnippet(embedUrl: string, title: string): string {
  return `<iframe src="${escapeHtmlAttr(embedUrl)}" title="${escapeHtmlAttr(title)}" width="100%" height="400" style="border:0"></iframe>`;
}

interface ShareDropdownProps {
  title: string;
  url?: string;
  promptId?: string;
  /** Prompt text copied into the existing /embed page. */
  prompt?: string;
}

export function ShareDropdown({ title, url, promptId, prompt }: ShareDropdownProps) {
  const t = useTranslations("prompts");
  const [copied, setCopied] = useState<"url" | "iframe" | null>(null);
  const canEmbed = Boolean(prompt);

  const handleShare = (platform: "twitter" | "hackernews") => {
    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    const encodedUrl = encodeURIComponent(shareUrl);
    let encodedTitle = encodeURIComponent(title);
    encodedTitle = `${encodedTitle} Prompt`;

    let targetUrl = "";

    if (platform === "twitter") {
      targetUrl = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
    } else if (platform === "hackernews") {
      targetUrl = `https://news.ycombinator.com/submitlink?u=${encodedUrl}&t=${encodedTitle}`;
    }

    window.open(targetUrl, "_blank", "noopener,noreferrer");
    analyticsPrompt.share(promptId, platform);
  };

  const handleCopyEmbed = async (kind: "url" | "iframe") => {
    if (!prompt || typeof window === "undefined") return;
    const embedUrl = buildEmbedUrl(window.location.origin, prompt);
    const text = kind === "url" ? embedUrl : buildEmbedSnippet(embedUrl, title);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(t("urlCopied"));
      analyticsPrompt.share(promptId, kind === "url" ? "embed" : "embed_iframe");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(t("failedToCopyUrl"));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleShare("twitter")}>
          <XIcon className="h-4 w-4 mr-2" />
          X / Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare("hackernews")}>
          <HackerNewsIcon className="h-4 w-4 mr-2" />
          Hacker News
        </DropdownMenuItem>
        {canEmbed && <DropdownMenuSeparator />}
        {canEmbed && (
          <DropdownMenuItem onClick={() => handleCopyEmbed("url")}>
            {copied === "url" ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Link className="h-4 w-4 mr-2" />
            )}
            {t("copyEmbedUrl")}
          </DropdownMenuItem>
        )}
        {canEmbed && (
          <DropdownMenuItem onClick={() => handleCopyEmbed("iframe")}>
            {copied === "iframe" ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Code className="h-4 w-4 mr-2" />
            )}
            {t("copyEmbedCode")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
