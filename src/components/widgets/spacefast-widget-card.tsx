"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Check, Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { analyticsWidget } from "@/lib/analytics";
import { SPACEFAST_MCP_CONNECT_URL, SPACEFAST_URL } from "@/lib/plugins/widgets/spacefast-links";
import type { WidgetPlacement } from "@/lib/plugins/widgets/types";
import { cn } from "@/lib/utils";

/** Example Spaces a bot might publish; cycled in the live-link ticker */
const EXAMPLE_SPACES = ["q3-report", "ops-dashboard", "launch-site"] as const;

interface SpacefastWidgetCardProps {
  widgetId: string;
  placement: WidgetPlacement;
}

export function SpacefastWidgetCard({ widgetId, placement }: SpacefastWidgetCardProps) {
  const t = useTranslations("widgets");
  const isTall = placement === "teams";

  return (
    <div
      data-testid="spacefast-widget"
      className={cn(
        "sf-widget group relative isolate flex min-w-0 flex-col overflow-hidden rounded-[var(--radius)] border bg-card p-4 transition-colors hover:border-foreground/20",
        "dark:border-white/10 dark:bg-[#030303] dark:hover:border-[#1efe57]/40",
        isTall && "h-full"
      )}
    >
      <style>{`
        .sf-widget-glow { background: radial-gradient(60% 70% at 85% 0%, #1efe5733, #0000 70%); }
        .dark .sf-widget-glow { background: radial-gradient(60% 70% at 85% 0%, #1efe5724, #0000 70%); }
        .sf-widget-gradient { background-image: linear-gradient(98deg, #059a35 10%, #4d7c0f 65%, #171717 100%); }
        .dark .sf-widget-gradient { background-image: linear-gradient(98deg, #1efe57 15%, #e5ff00 68%, #fff 100%); }
        @keyframes sfWidgetTicker {
          0%, 28% { transform: translateY(0); }
          33%, 61% { transform: translateY(-25%); }
          66%, 94% { transform: translateY(-50%); }
          100% { transform: translateY(-75%); }
        }
        @keyframes sfWidgetPulse {
          0%, 100% { box-shadow: 0 0 0 0 #1efe5780; }
          50% { box-shadow: 0 0 0 4px #1efe5700; }
        }
        .sf-widget-ticker { animation: sfWidgetTicker 7.5s cubic-bezier(.4, 0, .2, 1) infinite; }
        .sf-widget-pulse { animation: sfWidgetPulse 2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sf-widget-ticker, .sf-widget-pulse { animation: none; }
        }
      `}</style>
      <div aria-hidden="true" className="sf-widget-glow pointer-events-none absolute inset-0 -z-10" />

      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/sponsors/spacefast.svg" alt="" width={20} height={20} className="h-5 w-5 shrink-0" />
          <span className="text-sm font-semibold tracking-tight">Spacefast</span>
        </div>
        <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground dark:border-white/10">
          {t("sponsored")}
        </Badge>
      </div>

      <h2 className="mb-1.5 text-[15px] font-semibold leading-snug tracking-tight">
        <Link
          href={SPACEFAST_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => analyticsWidget.click(widgetId, "Spacefast")}
          className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {t.rich("spacefast.title", {
            hl: (chunks) => <span className="sf-widget-gradient bg-clip-text text-transparent">{chunks}</span>,
          })}
        </Link>
      </h2>
      <p className={cn("mb-3 text-xs text-muted-foreground wrap-anywhere dark:text-[#8e8e8e]", !isTall && "line-clamp-3")}>
        {t("spacefast.description")}
      </p>

      <div
        aria-hidden="true"
        className={cn(
          "mb-3 rounded-md border bg-background/70 px-2.5 py-2 font-mono text-[11px] backdrop-blur-sm dark:border-white/10 dark:bg-[#141414]/80",
          isTall && "mt-auto"
        )}
      >
        <p className="flex items-center gap-1.5 text-muted-foreground dark:text-[#8e8e8e]">
          <Check className="h-3 w-3 shrink-0 text-[#059a35] dark:text-[#1efe57]" />
          <span className="truncate">{t("spacefast.published")}</span>
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="sf-widget-pulse h-1.5 w-1.5 shrink-0 rounded-full bg-[#1efe57]" />
          <span className="shrink-0 font-medium text-[#059a35] dark:text-[#1efe57]">{t("spacefast.live")}</span>
          <span className="h-4 min-w-0 flex-1 overflow-hidden">
            <span className="sf-widget-ticker flex flex-col">
              {[...EXAMPLE_SPACES, EXAMPLE_SPACES[0]].map((space, index) => (
                <span key={index} className="h-4 truncate leading-4 text-foreground">
                  {space}.space.fast
                </span>
              ))}
            </span>
          </span>
        </div>
      </div>

      {isTall && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {(["privateByDefault", "sameLink", "versionHistory"] as const).map((feature) => (
            <li
              key={feature}
              className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground dark:border-white/10 dark:bg-white/5 dark:text-[#8e8e8e]"
            >
              {t(`spacefast.features.${feature}`)}
            </li>
          ))}
        </ul>
      )}

      <div className="relative z-10 mt-auto flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground dark:border-white/10">
        <Link
          href={SPACEFAST_MCP_CONNECT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => analyticsWidget.action(widgetId, "MCP connector", SPACEFAST_MCP_CONNECT_URL)}
          className="inline-flex min-w-0 items-center gap-1 font-medium text-foreground transition-colors hover:text-[#059a35] dark:hover:text-[#1efe57]"
        >
          <Plug className="h-3 w-3 shrink-0" />
          <span className="truncate">{t("spacefast.connector")}</span>
        </Link>
        <Link
          href={SPACEFAST_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => analyticsWidget.action(widgetId, "spacefast.com", SPACEFAST_URL)}
          className="inline-flex shrink-0 items-center gap-0.5 transition-colors hover:text-foreground"
        >
          spacefast.com
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
