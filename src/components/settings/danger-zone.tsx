"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { signOut } from "next-auth/react";
import { Download, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface DangerZoneProps {
  username: string;
}

export function DangerZone({ username }: DangerZoneProps) {
  const t = useTranslations("dangerZone");
  const tCommon = useTranslations("common");

  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await fetch("/api/user/export");
      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `prompts-export-${username}.json`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("exportFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmUsername.trim() !== username) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/user", {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || t("deleteFailed"));
      }

      toast.success(t("deleteSuccess"));
      setIsDialogOpen(false);
      await signOut({ callbackUrl: "/" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("deleteFailed");
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmed = confirmUsername.trim() === username;

  return (
    <Card className="border-destructive/30 dark:border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Data Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b">
          <div className="space-y-0.5">
            <h3 className="text-sm font-medium">{t("exportTitle")}</h3>
            <p className="text-xs text-muted-foreground max-w-md">
              {t("exportDescription")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || isDeleting}
            className="shrink-0"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isExporting ? t("exporting") : t("exportButton")}
          </Button>
        </div>

        {/* Delete Account Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-medium text-destructive">
              {t("deleteTitle")}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              {t("deleteDescription")}
            </p>
          </div>

          <AlertDialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setConfirmUsername("");
              }
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting || isExporting}
                className="shrink-0 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t("deleteButton")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  {t("dialogTitle")}
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-3 pt-2">
                  <span>{t("dialogDescription")}</span>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2 py-2">
                <Label htmlFor="confirm-username" className="text-xs text-foreground">
                  {t("confirmPrompt", { username })}
                </Label>
                <Input
                  id="confirm-username"
                  value={confirmUsername}
                  onChange={(e) => setConfirmUsername(e.target.value)}
                  placeholder={username}
                  autoComplete="off"
                  disabled={isDeleting}
                />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>
                  {tCommon("cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleDeleteAccount();
                  }}
                  disabled={!isConfirmed || isDeleting}
                  className="bg-destructive hover:bg-destructive/90 text-white"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("deleting")}
                    </>
                  ) : (
                    t("deleteButton")
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
