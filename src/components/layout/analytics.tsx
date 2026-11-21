"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import { useSession } from "next-auth/react";
import {
  applyAnalyticsAuthState,
  GA_LOGGED_IN_PROPERTY,
  type AnalyticsAuthState,
} from "@/lib/analytics";
import { COOKIE_CONSENT_KEY, getCookieConsent } from "./cookie-consent";

interface AnalyticsProps {
  gaId: string;
  /** Server-resolved sign-in state; undefined when it could not be determined. */
  loggedIn?: boolean;
  analyticsId?: string | null;
}

function toScriptLiteral(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Builds the gtag bootstrap. The auth state is set before `config` so the
 * initial page_view already carries it.
 */
export function buildGtagInitScript({ gaId, loggedIn, analyticsId }: AnalyticsProps): string {
  const lines = [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js', new Date());",
  ];

  if (loggedIn !== undefined) {
    lines.push(
      `gtag('set', 'user_properties', { ${GA_LOGGED_IN_PROPERTY}: ${toScriptLiteral(String(loggedIn))} });`
    );
  }

  if (loggedIn && analyticsId) {
    lines.push(
      `try { if (localStorage.getItem(${toScriptLiteral(COOKIE_CONSENT_KEY)}) === 'accepted') gtag('set', { user_id: ${toScriptLiteral(analyticsId)} }); } catch (e) {}`
    );
  }

  lines.push(`gtag('config', ${toScriptLiteral(gaId)});`);
  return lines.join("\n");
}

export function Analytics({ gaId, loggedIn, analyticsId }: AnalyticsProps) {
  const { data: session, status } = useSession();
  const applied = useRef<AnalyticsAuthState | null>(null);
  const sessionLoggedIn = !!session?.user;
  const sessionAnalyticsId = session?.user?.analyticsId ?? null;

  useEffect(() => {
    const consented = getCookieConsent() === "accepted";

    if (applied.current === null && loggedIn !== undefined) {
      applied.current = {
        loggedIn,
        userId: loggedIn && consented ? analyticsId ?? null : null,
      };
    }

    if (status === "loading") return;

    const next: AnalyticsAuthState = {
      loggedIn: sessionLoggedIn,
      userId: sessionLoggedIn && consented ? sessionAnalyticsId : null,
    };
    const current = applied.current;
    if (current && current.loggedIn === next.loggedIn && current.userId === next.userId) return;

    applyAnalyticsAuthState(next, current);
    applied.current = next;
  }, [status, sessionLoggedIn, sessionAnalyticsId, loggedIn, analyticsId]);

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {buildGtagInitScript({ gaId, loggedIn, analyticsId })}
      </Script>
    </>
  );
}
