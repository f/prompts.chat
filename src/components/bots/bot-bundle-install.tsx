"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, Layers } from "lucide-react";
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
import { CopyBlock, OpenAutogptButton } from "@/components/bots/bot-install";
import { BotPlatformTabsList } from "@/components/bots/bot-platform-tabs";
import type { BotBundleInstallOption } from "@/lib/bots/pairings";
import { analyticsBot } from "@/lib/analytics";

interface BotBundleInstallProps {
  botId: string;
  botTitle: string;
  /** The bot plus every paired bot */
  botCount: number;
  options: BotBundleInstallOption[];
}

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
          {platform === "AUTOGPT" ? t("installAllAutogptPromptHint") : t("installAllPromptHint", { platform: platformName })}
        </p>
        <CopyBlock
          text={installPrompt}
          label={t("copyInstallPrompt")}
          onCopy={() => analyticsBot.copyInstall(botId, platform, "bundle_prompt")}
        />
        {platform === "AUTOGPT" && <OpenAutogptButton botId={botId} />}
      </div>
    </div>
  );
}

/** "Install all together": the bot's install prompt and commands, extended to its paired bots */
export function BotBundleInstall({ botId, botTitle, botCount, options }: BotBundleInstallProps) {
  const t = useTranslations("bots");
  if (options.length === 0) return null;

  return (
    <Dialog onOpenChange={(open) => open && analyticsBot.installAllOpen(botId, botCount)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs">
          <Layers className="h-3.5 w-3.5" />
          {t("installAllTogether")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("installAllTitle", { count: botCount })}</DialogTitle>
          <DialogDescription>{t("installAllDescription", { bot: botTitle })}</DialogDescription>
        </DialogHeader>
        {options.length > 1 ? (
          <Tabs defaultValue={options[0].platform} className="min-w-0 gap-4">
            <BotPlatformTabsList platforms={options.map((option) => option.platform)} label={t("form.platforms")} />
            {options.map((option) => (
              <TabsContent key={option.platform} value={option.platform} className="min-w-0">
                <BundlePlatformInstall botId={botId} option={option} />
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <BundlePlatformInstall botId={botId} option={options[0]} />
        )}
      </DialogContent>
    </Dialog>
  );
}
