"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { BotTeamEditor, type TeamEditorValue } from "@/components/bots/teams/bot-team-editor";

/** Edit and delete buttons for a team's owner and admins */
export function BotTeamActions({ team }: { team: TeamEditorValue & { slug: string } }) {
  const t = useTranslations("bots.teams");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/bots/teams/${team.slug}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        return void toast.error(result.error === "rate_limit" ? t("form.rateLimit") : tCommon("somethingWentWrong"));
      }
      toast.success(t("deleted"));
      router.push("/bots/teams");
      router.refresh();
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <BotTeamEditor
        team={team}
        trigger={
          <Button size="sm" variant="outline" className="h-8 text-xs">
            <Pencil className="h-3.5 w-3.5 mr-1" />
            {t("edit")}
          </Button>
        }
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            {t("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
