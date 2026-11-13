"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bookmark, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analyticsCollection } from "@/lib/analytics";
import { usePromptStateChanges } from "@/lib/prompt-state";

interface AddToCollectionButtonProps {
  promptId: string;
  initialInCollection?: boolean;
  isLoggedIn: boolean;
}

export function AddToCollectionButton({
  promptId,
  initialInCollection = false,
  isLoggedIn,
}: AddToCollectionButtonProps) {
  const t = useTranslations("collection");
  const [inCollection, setInCollection] = useState(initialInCollection);
  // Changes made elsewhere arrive as new props after router.refresh(), or as events from WebMCP tools
  const [serverInCollection, setServerInCollection] = useState(initialInCollection);
  if (serverInCollection !== initialInCollection) {
    setServerInCollection(initialInCollection);
    setInCollection(initialInCollection);
  }
  const externalChanges = usePromptStateChanges(promptId, (change) => {
    if (change.inCollection !== undefined) setInCollection(change.inCollection);
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = async () => {
    if (!isLoggedIn) {
      window.location.href = "/login";
      return;
    }

    setIsLoading(true);
    const startedAt = externalChanges.current;
    const applyResult = (value: boolean) => {
      if (externalChanges.current === startedAt) setInCollection(value);
    };

    try {
      if (inCollection) {
        const res = await fetch(`/api/collection?promptId=${promptId}`, {
          method: "DELETE",
        });

        if (res.ok) {
          applyResult(false);
          analyticsCollection.remove(promptId);
          setShowTooltip(true);
          setTimeout(() => setShowTooltip(false), 2000);
        }
      } else {
        const res = await fetch("/api/collection", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promptId }),
        });

        if (res.ok) {
          applyResult(true);
          analyticsCollection.add(promptId);
          setShowTooltip(true);
          setTimeout(() => setShowTooltip(false), 2000);
        }
      }
    } catch (error) {
      console.error("Failed to update collection:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative">
      <Button
        variant={inCollection ? "secondary" : "outline"}
        size="sm"
        onClick={handleClick}
        disabled={isLoading}
        className={cn(
          "gap-1.5",
          inCollection && "bg-primary/10 text-primary hover:bg-primary/20"
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : inCollection ? (
          <Check className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
        {inCollection ? t("inCollection") : t("addToCollection")}
      </Button>

      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-xs font-medium bg-foreground text-background rounded shadow-lg whitespace-nowrap z-50 animate-in fade-in slide-in-from-top-1 duration-200">
          {inCollection ? t("added") : t("removed")}
        </div>
      )}
    </div>
  );
}
