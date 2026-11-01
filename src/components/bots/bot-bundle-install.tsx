"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, Layers, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { CopyBlock, OpenPlatformChatButton } from "@/components/bots/bot-install";
import { BOT_PLATFORM_CHAT_INSTALL, isChatInstallPlatform } from "@/lib/bots/schema";
import { BotPlatformTabsList } from "@/components/bots/bot-platform-tabs";
import type { BotBundleInstallOption } from "@/lib/bots/pairings";
import { analyticsBot } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface BotBundleInstallProps {
  /** Analytics id: the bot's id, or "team:<id>" for a team */
  botId: string;
  botTitle: string;
  /** The bot plus every paired bot */
  botCount: number;
  /** The install options, or a URL answering `{ options }` to load them from when the dialog first opens */
  options: BotBundleInstallOption[] | { url: string };
  /** Replace the "Install all together" button, title and description, e.g. for a team */
  labels?: { trigger: string; title: string; description: string };
  triggerClassName?: string;
}

type LoadState = { status: "idle" | "loading" | "error" } | { status: "ready"; options: BotBundleInstallOption[] };

function BundlePlatformInstall({ botId, option }: { botId: string; option: BotBundleInstallOption }) {
  const t = useTranslations("bots");
  const { platform, platformName, bots, skipped, installPrompt, command } = option;
  const templateLinks = bots.filter((bot) => bot.installUrl);

  return (
    <div className="min-w-0 space-y-4">
      {skipped.length > 0 && (
        <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
          {t("installAllSkipped", { platform: platformName, bots: skipped.join(", ") })}
        </p>
      )}

      {templateLinks.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("installAllTemplatesHint", { platform: platformName })}</p>
          <ul className="space-y-1">
            {templateLinks.map((bot) => (
              <li key={bot.id}>
                <a
                  href={bot.installUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm hover:underline"
                  onClick={() => {
                    analyticsBot.installClick(bot.id, platform);
                    analyticsBot.grokTemplateClick(bot.id, bot.installUrl!);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("openTemplate", { bot: bot.title })}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {command && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("installAllCommandHint")}</p>
          <CopyBlock
            text={command}
            label={t("copyCommands")}
            code
            onCopy={() => analyticsBot.copyInstall(botId, platform, "bundle_command")}
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {isChatInstallPlatform(platform)
            ? t(BOT_PLATFORM_CHAT_INSTALL[platform].bundleHint)
            : t("installAllPromptHint", { platform: platformName })}
        </p>
        <CopyBlock
          text={installPrompt}
          label={t("copyInstallPrompt")}
          onCopy={() => analyticsBot.copyInstall(botId, platform, "bundle_prompt")}
        />
        {isChatInstallPlatform(platform) && <OpenPlatformChatButton botId={botId} platform={platform} />}
      </div>
    </div>
  );
}

function BundleInstallOptions({ botId, options }: { botId: string; options: BotBundleInstallOption[] }) {
  const t = useTranslations("bots");
  if (options.length === 0) return <p className="text-sm text-muted-foreground">{t("installAllUnavailable")}</p>;
  if (options.length === 1) return <BundlePlatformInstall botId={botId} option={options[0]} />;
  return (
    <Tabs defaultValue={options[0].platform} className="min-w-0 gap-4">
      <BotPlatformTabsList platforms={options.map((option) => option.platform)} label={t("form.platforms")} />
      {options.map((option) => (
        <TabsContent key={option.platform} value={option.platform} className="min-w-0">
          <BundlePlatformInstall botId={botId} option={option} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

/** "Install all together": the bot's install prompt and commands, extended to its paired bots */
export function BotBundleInstall({ botId, botTitle, botCount, options, labels, triggerClassName }: BotBundleInstallProps) {
  const t = useTranslations("bots");
  const [loaded, setLoaded] = useState<LoadState>(
    Array.isArray(options) ? { status: "ready", options } : { status: "idle" }
  );
  if (Array.isArray(options) && options.length === 0) return null;

  const load = async (url: string) => {
    setLoaded({ status: "loading" });
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Install options: ${response.status}`);
      const data: { options: BotBundleInstallOption[] } = await response.json();
      setLoaded({ status: "ready", options: data.options });
    } catch {
      setLoaded({ status: "error" });
    }
  };

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) return;
        analyticsBot.installAllOpen(botId, botCount);
        if (!Array.isArray(options) && (loaded.status === "idle" || loaded.status === "error")) void load(options.url);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant={labels ? "default" : "outline"} className={cn("h-8 text-xs", triggerClassName)}>
          <Layers className="h-3.5 w-3.5" />
          {labels?.trigger ?? t("installAllTogether")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels?.title ?? t("installAllTitle", { count: botCount })}</DialogTitle>
          <DialogDescription>{labels?.description ?? t("installAllDescription", { bot: botTitle })}</DialogDescription>
        </DialogHeader>
        {loaded.status === "ready" ? (
          <BundleInstallOptions botId={botId} options={loaded.options} />
        ) : loaded.status === "error" ? (
          <p role="alert" className="text-sm text-muted-foreground">{t("installAllLoadError")}</p>
        ) : (
          <div className="flex justify-center py-8" aria-busy="true">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
