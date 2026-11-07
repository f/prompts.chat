import Link from "next/link";
import Image from "next/image";
import { BuiltWithLink } from "@/components/layout/sponsor-link";

// Each label stays in the same no-wrap group as its logo so narrow screens
// break between groups instead of orphaning words ("by" / "Cognition").
export function BuiltWith() {
  return (
    <div
      data-testid="built-with"
      className="flex flex-col md:flex-row md:flex-wrap items-center justify-center gap-x-1.5 gap-y-2.5 mt-4 pt-4 border-t text-xs text-muted-foreground text-center"
    >
      <span data-testid="built-with-lead" className="max-w-full">
        <b>prompts.chat</b> is built with
      </span>
      <span
        data-testid="built-with-tools"
        className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-2"
      >
        <span data-testid="built-with-devin" className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          <BuiltWithLink href="https://devin.ai/?utm_source=prompts.chat" toolName="Devin">
            <Image
              src="/sponsors/devin.svg"
              alt="Devin"
              width={80}
              height={20}
              className="h-6 w-auto shrink-0 dark:hidden"
            />
            <Image
              src="/sponsors/devin-dark.svg"
              alt="Devin"
              width={80}
              height={20}
              className="h-6 w-auto shrink-0 hidden dark:block"
            />
          </BuiltWithLink>
          <span>by Cognition</span>
        </span>
        <span data-testid="built-with-grok" className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
          <span>and</span>
          <BuiltWithLink href="https://grok.com/?utm_source=prompts.chat" toolName="Grok Bot">
            <Image
              src="/sponsors/grok-bot.svg"
              alt="Grok Bot"
              width={80}
              height={20}
              className="h-6 w-auto shrink-0 dark:hidden"
            />
            <Image
              src="/sponsors/grok-bot-dark.svg"
              alt="Grok Bot"
              width={80}
              height={20}
              className="h-6 w-auto shrink-0 hidden dark:block"
            />
          </BuiltWithLink>
        </span>
      </span>
      <span data-testid="built-with-separator" aria-hidden="true" className="hidden md:inline mx-0.5">
        ·
      </span>
      <span data-testid="built-with-hosting" className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-2">
        <span>hosted on</span>
        <Link
          href="https://vercel.com/oss"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center opacity-60 hover:opacity-100 transition-opacity"
        >
          <Image
            src="/sponsors/vercel-oss.svg"
            alt="Vercel OSS Program"
            width={240}
            height={24}
            className="h-4.5 w-auto max-w-full shrink-0 dark:hidden"
          />
          <Image
            src="/sponsors/vercel-oss-dark.svg"
            alt="Vercel OSS Program"
            width={240}
            height={24}
            className="h-4.5 w-auto max-w-full shrink-0 hidden dark:block"
          />
        </Link>
      </span>
    </div>
  );
}
