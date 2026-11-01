import { Badge } from "@/components/ui/badge";
import { BotPlatformIcon } from "@/components/bots/bot-platform-icon";
import { BOT_PLATFORM_INFO, type BotPlatform } from "@/lib/bots/schema";
import { cn } from "@/lib/utils";

const PLATFORM_STYLES: Record<BotPlatform, string> = {
  OPENCLAW: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  HERMES: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  GROK_BOT: "border-foreground/20 bg-foreground/5 text-foreground",
  AUTOGPT: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  DOTS: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  DUET: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  MUSE: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
};

interface BotPlatformBadgeProps {
  platform: BotPlatform;
  className?: string;
}

export function BotPlatformBadge({ platform, className }: BotPlatformBadgeProps) {
  return (
    <Badge variant="outline" className={cn(PLATFORM_STYLES[platform], className)}>
      <BotPlatformIcon platform={platform} className="h-3 w-3" />
      {BOT_PLATFORM_INFO[platform].name}
    </Badge>
  );
}
