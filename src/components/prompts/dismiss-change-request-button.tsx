"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { analyticsPrompt } from "@/lib/analytics";

interface DismissChangeRequestButtonProps {
  changeRequestId: string;
  promptId: string;
  /** Where to go after dismissing; defaults to the prompt page */
  redirectTo?: string;
  /** API endpoint of the request; defaults to the prompt change request endpoint */
  apiPath?: string;
}

export function DismissChangeRequestButton({ changeRequestId, promptId, redirectTo, apiPath }: DismissChangeRequestButtonProps) {
  const router = useRouter();
  const t = useTranslations("changeRequests");
  const tCommon = useTranslations("common");
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDismiss = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(apiPath ?? `/api/prompts/${promptId}/changes/${changeRequestId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to dismiss change request");
      }

      if (!apiPath) analyticsPrompt.changeRequest(promptId, "dismiss");
      toast.success(t("dismissed"));
      router.push(redirectTo ?? `/prompts/${promptId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tCommon("error"));
    } finally {
      setIsLoading(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-1.5" />
          {t("dismiss")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dismissConfirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("dismissConfirmDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDismiss}
            disabled={isLoading}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("dismiss")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
