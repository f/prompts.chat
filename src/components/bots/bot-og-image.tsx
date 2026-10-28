/* eslint-disable @next/next/no-img-element -- satori renders plain <img>, next/image does not apply */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { BOT_ICON_COMPONENTS } from "@/components/bots/bot-avatar";
import { GrokLogo } from "@/components/bots/bot-platform-icon";
import { getConfig } from "@/lib/config";
import { BOT_PLATFORM_INFO, BOT_PLATFORMS, type BotColor, type BotIconName, type BotPlatform } from "@/lib/bots/schema";

export const BOT_OG_SIZE = { width: 1200, height: 630 };

/** Tailwind 500 and 700 shades, matching the tile classes in bot-avatar.tsx */
const COLOR_HEX: Record<BotColor, { base: string; text: string }> = {
  slate: { base: "#64748b", text: "#334155" },
  red: { base: "#ef4444", text: "#b91c1c" },
  orange: { base: "#f97316", text: "#c2410c" },
  amber: { base: "#f59e0b", text: "#b45309" },
  lime: { base: "#84cc16", text: "#4d7c0f" },
  emerald: { base: "#10b981", text: "#047857" },
  teal: { base: "#14b8a6", text: "#0f766e" },
  sky: { base: "#0ea5e9", text: "#0369a1" },
  blue: { base: "#3b82f6", text: "#1d4ed8" },
  indigo: { base: "#6366f1", text: "#4338ca" },
  violet: { base: "#8b5cf6", text: "#6d28d9" },
  pink: { base: "#ec4899", text: "#be185d" },
};

const NEUTRAL_TILE = { background: "#f4f4f5", border: "#e4e4e7", text: "#71717a" };

function tileColors(color: BotColor | null) {
  if (!color) return NEUTRAL_TILE;
  const { base, text } = COLOR_HEX[color];
  // 15% and 30% alpha, like bg-*-500/15 and border-*-500/30
  return { background: `${base}26`, border: `${base}4d`, text };
}

type RenderFn = (props: Record<string, unknown>, ref: null) => ReactNode;

/**
 * Satori only understands host elements, and react-dom/server is off limits in
 * app routes, so hook-free icon components (lucide's forwardRefs, GrokLogo) are
 * expanded into plain <svg> trees here.
 */
function expandIcon(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const type = element.type as unknown;
  if (typeof type === "function") return expandIcon((type as RenderFn)(element.props, null));
  if (typeof type === "object" && type !== null && "render" in type) {
    return expandIcon((type as { render: RenderFn }).render(element.props, null));
  }
  const children = Children.toArray(element.props.children as ReactNode).map(expandIcon);
  return cloneElement(element, { className: undefined }, ...children);
}

async function publicFileDataUri(file: string, mime: string): Promise<string> {
  const data = await readFile(join(process.cwd(), "public", file));
  return `data:${mime};base64,${data.toString("base64")}`;
}

const LOGO_SIZE = 32;

async function platformLogos(): Promise<Record<BotPlatform, ReactNode>> {
  const [openclaw, hermes, autogpt] = await Promise.all([
    publicFileDataUri("bots/openclaw.svg", "image/svg+xml"),
    publicFileDataUri("bots/hermes.png", "image/png"),
    publicFileDataUri("bots/autogpt.svg", "image/svg+xml"),
  ]);
  return {
    GROK_BOT: expandIcon(<GrokLogo width={LOGO_SIZE} height={LOGO_SIZE} fill="#18181b" />),
    OPENCLAW: <img src={openclaw} width={LOGO_SIZE} height={LOGO_SIZE} alt="" />,
    HERMES: <img src={hermes} width={LOGO_SIZE} height={LOGO_SIZE} alt="" />,
    AUTOGPT: <img src={autogpt} width={LOGO_SIZE} height={LOGO_SIZE} alt="" />,
  };
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function PlatformChips({ platforms, logos }: { platforms: BotPlatform[]; logos: Record<BotPlatform, ReactNode> }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {platforms.map((platform) => (
        <div
          key={platform}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px",
            borderRadius: 999,
            border: "2px solid #e4e4e7",
            backgroundColor: "#ffffff",
            fontSize: 24,
            fontWeight: 600,
            color: "#18181b",
          }}
        >
          {logos[platform]}
          <span>{BOT_PLATFORM_INFO[platform].name}</span>
        </div>
      ))}
    </div>
  );
}

export interface BotOgImageInput {
  title: string;
  description: string | null;
  instructions: string;
  icon: BotIconName | null;
  color: BotColor | null;
  platforms: BotPlatform[];
  author: { username: string; name: string | null; avatar: string | null };
}

export async function renderBotOgImage(bot: BotOgImageInput | null) {
  const config = await getConfig();
  const primary = config.theme?.colors?.primary || "#6366f1";

  if (!bot) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
            color: "#fff",
            fontSize: 48,
            fontWeight: 600,
          }}
        >
          Bot Not Found
        </div>
      ),
      { ...BOT_OG_SIZE }
    );
  }

  const logos = await platformLogos();
  const tile = tileColors(bot.color);
  const Icon = BOT_ICON_COMPONENTS[bot.icon ?? "bot"];
  const icon = expandIcon(<Icon size={112} color={tile.text} strokeWidth={1.75} />);
  const description = truncate(bot.description || bot.instructions, 180);
  const authorName = bot.author.name || bot.author.username;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          padding: "48px 56px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 24, fontWeight: 600, color: primary }}>{config.branding.name}</span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: primary,
              backgroundColor: `${primary}1a`,
              padding: "8px 16px",
              borderRadius: 999,
            }}
          >
            AI Agent Bot
          </span>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 44 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 200,
              height: 200,
              borderRadius: 40,
              backgroundColor: tile.background,
              border: `3px solid ${tile.border}`,
            }}
          >
            {icon}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
            <div
              style={{
                display: "flex",
                fontSize: bot.title.length > 40 ? 52 : 64,
                fontWeight: 700,
                color: "#18181b",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              {truncate(bot.title, 80)}
            </div>
            {description && (
              <div style={{ display: "flex", fontSize: 28, color: "#52525b", lineHeight: 1.4 }}>{description}</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <PlatformChips platforms={bot.platforms} logos={logos} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {bot.author.avatar ? (
              <img
                src={bot.author.avatar}
                width={48}
                height={48}
                alt=""
                style={{ borderRadius: 24, border: "2px solid #e4e4e7" }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: "#f4f4f5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#71717a",
                  fontSize: 20,
                  fontWeight: 600,
                  border: "2px solid #e4e4e7",
                }}
              >
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
            <span style={{ color: "#18181b", fontSize: 22, fontWeight: 600 }}>@{bot.author.username}</span>
          </div>
        </div>
      </div>
    ),
    { ...BOT_OG_SIZE }
  );
}

export async function renderBotsListingOgImage({ heading, description }: { heading: string; description: string }) {
  const config = await getConfig();
  const primary = config.theme?.colors?.primary || "#6366f1";
  const logos = await platformLogos();
  const Icon = BOT_ICON_COMPONENTS.bot;
  const icon = expandIcon(<Icon size={112} color={primary} strokeWidth={1.75} />);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          padding: "48px 56px",
        }}
      >
        <span style={{ fontSize: 24, fontWeight: 600, color: primary }}>{config.branding.name}</span>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 44 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 200,
              height: 200,
              borderRadius: 40,
              backgroundColor: `${primary}1a`,
              border: `3px solid ${primary}40`,
            }}
          >
            {icon}
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 16 }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "#18181b", letterSpacing: "-0.02em" }}>
              {heading}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: "#52525b", lineHeight: 1.4 }}>{description}</div>
          </div>
        </div>
        <PlatformChips platforms={[...BOT_PLATFORMS]} logos={logos} />
      </div>
    ),
    { ...BOT_OG_SIZE }
  );
}
