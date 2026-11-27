"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "cookie-consent";

export type CookieConsent = "accepted" | "rejected" | null;

export function getCookieConsent(): CookieConsent {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(COOKIE_CONSENT_KEY) as CookieConsent;
}

export function CookieConsentBanner() {
  const t = useTranslations("cookies");
  const [consent, setConsent] = useState<CookieConsent | "pending">("pending");
  const [confirmReject, setConfirmReject] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerHeight, setBannerHeight] = useState(0);

  useEffect(() => {
    setConsent(getCookieConsent());
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setConsent("accepted");
    window.location.reload();
  };

  const handleRejectClick = () => {
    if (confirmReject) {
      localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
      setConsent("rejected");
    } else {
      setConfirmReject(true);
    }
  };

  const handleNevermind = () => {
    setConfirmReject(false);
  };

  const visible = consent === null;
  useEffect(() => {
    const banner = bannerRef.current;
    if (!visible || !banner) return;
    const observer = new ResizeObserver(() => setBannerHeight(banner.offsetHeight));
    observer.observe(banner);
    return () => observer.disconnect();
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      {/* Keeps the end of every page scrollable above the banner, which wraps to two lines on phones */}
      <div aria-hidden="true" className="shrink-0" style={{ height: bannerHeight }} />
      <div ref={bannerRef} className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex items-center justify-between gap-4 py-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Cookie className="h-3.5 w-3.5 shrink-0" />
            <span>{confirmReject ? t("confirmMessage") : t("message")}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {confirmReject ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleNevermind}
                >
                  {t("nevermind")}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleRejectClick}
                >
                  {t("confirmReject")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleRejectClick}
                >
                  {t("reject")}
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleAccept}
                >
                  {t("accept")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
