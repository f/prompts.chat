/* eslint-disable @next/next/no-img-element -- tiny static logos, next/image adds nothing here */
import type { SVGProps } from "react";
import type { BotPlatform } from "@/lib/bots/schema";
import { cn } from "@/lib/utils";

/** Grok mark from grok.com, drawn in currentColor so it follows the theme */
export function GrokLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="56 56 400 400" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M210.484 312.759L343.465 210.383C349.984 205.364 359.302 207.322 362.408 215.117C378.758 256.231 371.454 305.64 338.925 339.563C306.397 373.487 261.137 380.927 219.768 363.983L174.577 385.803C239.394 432.008 318.104 420.581 367.289 369.251C406.303 328.564 418.386 273.104 407.088 223.091L407.19 223.198C390.807 149.726 411.218 120.359 453.03 60.3072C454.02 58.8833 455.01 57.4595 456 56L400.978 113.382V113.204L210.45 312.794Z" />
      <path d="M183.042 337.641C136.519 291.294 144.54 219.567 184.236 178.203C213.59 147.59 261.683 135.096 303.666 153.464L348.755 131.75C340.632 125.627 330.221 119.042 318.275 114.414C264.277 91.2407 199.63 102.774 155.735 148.516C113.513 192.549 100.236 260.254 123.036 318.027C140.069 361.206 112.148 391.748 84.0229 422.575C74.0561 433.503 64.0553 444.431 56 456L183.007 337.677Z" />
    </svg>
  );
}

interface BotPlatformIconProps {
  platform: BotPlatform;
  className?: string;
}

/** Decorative logo; callers provide the accessible name */
export function BotPlatformIcon({ platform, className }: BotPlatformIconProps) {
  const size = cn("h-4 w-4 shrink-0", className);
  switch (platform) {
    case "GROK_BOT":
      return <GrokLogo className={size} />;
    case "OPENCLAW":
      return <img src="/bots/openclaw.svg" alt="" aria-hidden="true" className={size} />;
    case "HERMES":
      return (
        <>
          <img src="/bots/hermes.png" alt="" aria-hidden="true" className={cn(size, "dark:hidden")} />
          <img src="/bots/hermes-dark.png" alt="" aria-hidden="true" className={cn(size, "hidden dark:block")} />
        </>
      );
    case "AUTOGPT":
      return (
        <>
          <img src="/bots/autogpt.svg" alt="" aria-hidden="true" className={cn(size, "dark:hidden")} />
          <img src="/bots/autogpt-dark.svg" alt="" aria-hidden="true" className={cn(size, "hidden dark:block")} />
        </>
      );
  }
}
