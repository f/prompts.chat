"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { analyticsPrompt } from "@/lib/analytics";

interface ReopenChangeRequestButtonProps {
  changeRequestId: string;
  promptId: string;
  /** API endpoint of the request; defaults to the prompt change request endpoint */
  apiPath?: string;
}

export function ReopenChangeRequestButton({ changeRequestId, promptId, apiPath }: ReopenChangeRequestButtonProps) {
  const router = useRouter();
  const t = useTranslations("changeRequests");
  const tCommon = useTranslations("common");
  const [isLoading, setIsLoading] = useState(false);

  const handleReopen = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(apiPath ?? `/api/prompts/${promptId}/changes/${changeRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING" }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reopen change request");
      }

      if (!apiPath) analyticsPrompt.changeRequest(promptId, "reopen");
      toast.success(t("reopenedSuccess"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tCommon("somethingWentWrong"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleReopen}
      disabled={isLoading}
      variant="outline"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <RotateCcw className="h-4 w-4 mr-2" />
      )}
      {t("reopen")}
    </Button>
  );
}
