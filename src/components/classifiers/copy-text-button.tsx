"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CopyTextButtonProps {
  label: string;
  /** Text to copy. Ignored when `copyPageUrl` is set. */
  text?: string;
  /** Copy the current page URL, optionally with a hash. */
  copyPageUrl?: boolean;
  hash?: string;
  variant?: "outline" | "ghost" | "secondary";
}

export function CopyTextButton({ label, text = "", copyPageUrl = false, hash, variant = "outline" }: CopyTextButtonProps) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      let value = text;
      if (copyPageUrl) {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = hash ?? "";
        value = url.toString();
      }
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("failedToCopy"));
    }
  };

  const Icon = copied ? Check : copyPageUrl ? Link2 : Copy;

  return (
    <Button type="button" variant={variant} size="sm" className="h-8 gap-1.5 text-xs" onClick={handleCopy}>
      <Icon className={copied ? "h-3.5 w-3.5 text-green-500" : "h-3.5 w-3.5"} />
      {label}
    </Button>
  );
}
