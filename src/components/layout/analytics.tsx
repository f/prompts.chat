"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { getCookieConsent } from "./cookie-consent";

interface AnalyticsProps {
  gaId: string;
}

export function Analytics({ gaId }: AnalyticsProps) {
  const [hasConsent, setHasConsent] = useState(false);

  useEffect(() => {
    setHasConsent(getCookieConsent() === "accepted");
  }, []);

  if (!hasConsent) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
