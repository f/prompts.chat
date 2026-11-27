"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ExternalLink, FileCode2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { BotPlatformTabsList } from "@/components/bots/bot-platform-tabs";
import type { BotInstallOption } from "@/lib/bots";
import { BOT_PLATFORM_CHAT_INSTALL, isChatInstallPlatform, type ChatInstallPlatform } from "@/lib/bots/schema";
import { cn } from "@/lib/utils";
import { analyticsBot } from "@/lib/analytics";

interface BotInstallProps {
  botId: string;
  options: BotInstallOption[];
  urls: { markdown: string; json: string; skill: string };
}

export function CopyBlock({
  text,
  label,
  code = false,
  onCopy,
}: {
  text: string;
  label: string;
  code?: boolean;
  onCopy?: () => void;
}) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("failedToCopy"));
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      <pre
        className={cn(
          "max-w-full overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs font-mono leading-relaxed",
          code ? "whitespace-pre" : "whitespace-pre-wrap wrap-anywhere"
        )}
      >
        {text}
      </pre>
      <Button size="sm" variant="outline" className="w-full" onClick={copy}>
        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        {label}
      </Button>
    </div>
  );
}

function PlatformInstall({ botId, option }: { botId: string; option: BotInstallOption }) {
  const t = useTranslations("bots");
  const { platform, platformName, installUrl, installPrompt, command } = option;
  const hasPrimaryAction = platform === "GROK_BOT" || !!command;

  return (
    <div className="min-w-0 space-y-4">
      {installUrl ? (
        <Button asChild className="w-full">
          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              analyticsBot.installClick(botId, platform);
              if (platform === "GROK_BOT") analyticsBot.grokTemplateClick(botId, installUrl);
            }}
          >
            <ExternalLink className="h-4 w-4" />
            {t("installOn", { platform: platformName })}
          </a>
        </Button>
      ) : platform === "GROK_BOT" && (
        <div className="space-y-1">
          <Button className="w-full" disabled>
            <ExternalLink className="h-4 w-4" />
            {t("installOn", { platform: platformName })}
          </Button>
          <p className="text-xs text-muted-foreground text-center">{t("installLinkComingSoon")}</p>
        </div>
      )}

      {command && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("hermesCommandHint")}</p>
          <CopyBlock
            text={command}
            label={t("copyCommand")}
            code
            onCopy={() => analyticsBot.copyInstall(botId, platform, "command")}
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {isChatInstallPlatform(platform)
            ? t(BOT_PLATFORM_CHAT_INSTALL[platform].hint)
            : hasPrimaryAction
              ? t("installPromptPlatformFallbackHint", { platform: platformName })
              : t("installPromptHint")}
        </p>
        <CopyBlock
          text={installPrompt}
          label={t("copyInstallPrompt")}
          onCopy={() => analyticsBot.copyInstall(botId, platform, "prompt")}
        />
        {isChatInstallPlatform(platform) && <OpenPlatformChatButton botId={botId} platform={platform} />}
      </div>
    </div>
  );
}

export function OpenPlatformChatButton({ botId, platform }: { botId: string; platform: ChatInstallPlatform }) {
  const t = useTranslations("bots");
  const { url, open } = BOT_PLATFORM_CHAT_INSTALL[platform];
  return (
    <Button asChild size="sm" variant="ghost" className="w-full">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => analyticsBot.installClick(botId, platform)}
      >
        <ExternalLink className="h-4 w-4" />
        {t(open)}
      </a>
    </Button>
  );
}

export function BotInstall({ botId, options, urls }: BotInstallProps) {
  const t = useTranslations("bots");

  return (
    <div className="min-w-0 space-y-4">
      {options.length > 1 ? (
        <Tabs
          defaultValue={options[0].platform}
          onValueChange={(platform) => analyticsBot.tabChange(botId, platform)}
          className="gap-4"
        >
          <BotPlatformTabsList platforms={options.map((option) => option.platform)} label={t("form.platforms")} />
          {options.map((option) => (
            <TabsContent key={option.platform} value={option.platform} className="min-w-0">
              <PlatformInstall botId={botId} option={option} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        options[0] && <PlatformInstall botId={botId} option={options[0]} />
      )}

      <div className="space-y-1 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">{t("machineReadable")}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {[
            { href: urls.markdown, label: ".md" },
            { href: urls.json, label: ".json" },
            { href: urls.skill, label: "SKILL.md" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
            >
              <FileCode2 className="h-3 w-3" />
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
