"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UnlistTeamButtonProps {
  teamId: string;
  isUnlisted: boolean;
  className?: string;
}

export function UnlistTeamButton({ teamId, isUnlisted: initialUnlisted, className }: UnlistTeamButtonProps) {
  const t = useTranslations("bots.teams");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [isUnlisted, setIsUnlisted] = useState(initialUnlisted);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isUnlisted: !isUnlisted }),
      });
      if (!response.ok) throw new Error("Request failed");
      const data = await response.json();
      setIsUnlisted(data.isUnlisted);
      toast.success(data.isUnlisted ? t("unlistedToast") : t("relistedToast"));
      router.refresh();
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isUnlisted ? "destructive" : "outline"}
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className={cn("gap-1.5", className)}
    >
      {isUnlisted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      {isUnlisted ? t("relist") : t("unlist")}
    </Button>
  );
}
