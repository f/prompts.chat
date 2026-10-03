"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { analyticsPrompt } from "@/lib/analytics";

interface CopyButtonProps {
  content: string;
  promptId?: string;
}

export function CopyButton({ content, promptId }: CopyButtonProps) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      analyticsPrompt.copy(promptId);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("failedToCopy"));
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={copyToClipboard} className="cursor-pointer">
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </Button>
  );
}
