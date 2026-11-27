"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { analyticsPrompt } from "@/lib/analytics";

interface ChangeRequestActionsProps {
  changeRequestId: string;
  promptId: string;
  /** API endpoint of the request; defaults to the prompt change request endpoint */
  apiPath?: string;
  /** Toast after approving; defaults to the prompt message */
  approvedMessage?: string;
}

export function ChangeRequestActions({ changeRequestId, promptId, apiPath, approvedMessage }: ChangeRequestActionsProps) {
  const router = useRouter();
  const t = useTranslations("changeRequests");
  const tCommon = useTranslations("common");
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const handleAction = async (selectedAction: "approve" | "reject") => {
    setIsLoading(true);
    setAction(selectedAction);

    try {
      const response = await fetch(apiPath ?? `/api/prompts/${promptId}/changes/${changeRequestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: selectedAction === "approve" ? "APPROVED" : "REJECTED",
          reviewNote: reviewNote || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update change request");
      }

      if (!apiPath) analyticsPrompt.changeRequest(promptId, selectedAction === "approve" ? "approve" : "dismiss");
      toast.success(selectedAction === "approve" ? (approvedMessage ?? t("approvedSuccess")) : t("rejectedSuccess"));
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tCommon("somethingWentWrong"));
    } finally {
      setIsLoading(false);
      setAction(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t("reviewActions")}</p>
      <Textarea
        id="reviewNote"
        value={reviewNote}
        onChange={(e) => setReviewNote(e.target.value)}
        placeholder={t("reviewNotePlaceholder")}
        className="min-h-[60px] text-sm"
      />
      <div className="flex gap-2">
        <Button
          onClick={() => handleAction("approve")}
          disabled={isLoading}
          size="sm"
          className="flex-1 bg-green-600 hover:bg-green-700"
        >
          {isLoading && action === "approve" ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-1.5" />
          )}
          {t("approve")}
        </Button>
        <Button
          onClick={() => handleAction("reject")}
          disabled={isLoading}
          variant="destructive"
          size="sm"
          className="flex-1"
        >
          {isLoading && action === "reject" ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <X className="h-4 w-4 mr-1.5" />
          )}
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}
