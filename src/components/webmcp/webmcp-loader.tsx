"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setLocale } from "@/lib/i18n/client";

interface WebMcpLoaderProps {
  /** The site's primary color, for the widget */
  color: string;
  locales: string[];
}

/**
 * Exposes the site to AI agents through WebMCP once the browser is idle. Renders nothing itself:
 * the tool code and the widget script load lazily, after hydration, so they never block a page.
 */
export function WebMcpLoader({ color, locales }: WebMcpLoaderProps) {
  const t = useTranslations("webmcp");
  const router = useRouter();
  const routerRef = useRef(router);
  const labelsRef = useRef({ open: t("open"), tokenPlaceholder: t("tokenPlaceholder"), connect: t("connect"), disconnect: t("disconnect"), close: t("close") });

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (cancelled) return;
      try {
        const { startWebMcp, waitForPath, waitUntil } = await import("@/lib/webmcp");
        const location = () => new URL(window.location.href);
        await startWebMcp(
          {
            fetch: (input, init) => window.fetch(input, { credentials: "same-origin", ...init }),
            location,
            document: () => document,
            navigate: async (path) => {
              const previousTitle = document.title;
              routerRef.current.push(path);
              // The title is set after the URL changes; same-titled pages just wait out the timeout
              if (await waitForPath(location, path)) await waitUntil(() => !!document.title && document.title !== previousTitle, 1000);
            },
            refresh: () => routerRef.current.refresh(),
            setLocale,
            locales,
          },
          { color, labels: labelsRef.current }
        );
      } catch (error) {
        console.warn("WebMCP could not start:", error);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(start, { timeout: 5000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(handle);
      };
    }
    const timer = window.setTimeout(start, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [color, locales]);

  return null;
}
