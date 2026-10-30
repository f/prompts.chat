"use client";

import { useState, useCallback } from "react";
import { Play, ExternalLink, Zap, Clipboard, Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { analyticsPrompt } from "@/lib/analytics";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBranding } from "@/components/providers/branding-provider";
import {
  buildUrl,
  chatPlatforms,
  codePlatforms,
  imagePlatforms,
  videoPlatforms,
  type Platform,
} from "@/lib/run-platforms";

interface UnfilledVariable {
  name: string;
  defaultValue: string;
}

interface RunPromptButtonProps {
  content: string;
  title?: string;
  description?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  className?: string;
  unfilledVariables?: UnfilledVariable[];
  onVariablesFilled?: (values: Record<string, string>) => void;
  getContentWithVariables?: (values: Record<string, string>) => string;
  promptId?: string;
  categoryName?: string;
  parentCategoryName?: string;
  emphasized?: boolean;
  promptType?: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STRUCTURED" | "SKILL";
}

// Check if category or parent category suggests code-related content
function isCodeCategory(name?: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.includes("code") || lower.includes("coding") || lower.includes("vibe");
}

function getDefaultTab(categoryName?: string, parentCategoryName?: string): "chat" | "code" {
  if (isCodeCategory(categoryName) || isCodeCategory(parentCategoryName)) {
    return "code";
  }
  return "chat";
}

export function RunPromptButton({ 
  content, 
  title,
  description,
  variant = "outline", 
  size = "sm",
  className,
  unfilledVariables = [],
  onVariablesFilled,
  getContentWithVariables,
  promptId,
  categoryName,
  parentCategoryName,
  emphasized = false,
  promptType = "TEXT"
}: RunPromptButtonProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const { useCloneBranding } = useBranding();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [variableDialogOpen, setVariableDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "code">(() => getDefaultTab(categoryName, parentCategoryName));
  const [pendingPlatform, setPendingPlatform] = useState<{ id: string; name: string; baseUrl: string; supportsQuerystring?: boolean } | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Initialize variable values when dialog opens
  const openVariableDialog = useCallback((platform: Platform, baseUrl: string) => {
    const initial: Record<string, string> = {};
    for (const v of unfilledVariables) {
      initial[v.name] = v.defaultValue;
    }
    setVariableValues(initial);
    setPendingPlatform({ id: platform.id, name: platform.name, baseUrl, supportsQuerystring: platform.supportsQuerystring });
    setVariableDialogOpen(true);
  }, [unfilledVariables]);

  const handleVariableSubmit = useCallback(() => {
    if (onVariablesFilled) {
      onVariablesFilled(variableValues);
    }
    setVariableDialogOpen(false);
    
    if (pendingPlatform) {
      const finalContent = getContentWithVariables 
        ? getContentWithVariables(variableValues) 
        : content;
      
      if (pendingPlatform.supportsQuerystring === false) {
        navigator.clipboard.writeText(finalContent);
        setDialogOpen(true);
      } else {
        const url = buildUrl(pendingPlatform.id, pendingPlatform.baseUrl, finalContent, title, description);
        // Only open in new tab for http/https URLs
        if (url.startsWith("http://") || url.startsWith("https://")) {
          window.open(url, "_blank");
        } else {
          window.location.href = url;
        }
        setPendingPlatform(null);
      }
      analyticsPrompt.run(promptId, pendingPlatform.name);
    }
  }, [variableValues, onVariablesFilled, pendingPlatform, getContentWithVariables, content, promptId]);

  const handleRun = (platform: Platform, baseUrl: string) => {
    // Check if there are any variables to fill
    const hasVariables = unfilledVariables.length > 0;
    
    if (hasVariables) {
      // Show variable fill dialog first (for both query string and copy flows)
      openVariableDialog(platform, baseUrl);
      return;
    }
    
    if (platform.supportsQuerystring === false) {
      navigator.clipboard.writeText(content);
      setPendingPlatform({ id: platform.id, name: platform.name, baseUrl, supportsQuerystring: platform.supportsQuerystring });
      setDialogOpen(true);
      analyticsPrompt.run(promptId, platform.name);
    } else {
      const url = buildUrl(platform.id, baseUrl, content, title, description);
      // Only open in new tab for http/https URLs
      if (url.startsWith("http://") || url.startsWith("https://")) {
        window.open(url, "_blank");
      } else {
        // eslint-disable-next-line react-hooks/immutability -- Valid browser navigation for custom URL schemes
        window.location.href = url;
      }
      analyticsPrompt.run(promptId, platform.name);
    }
  };

  const handleOpenPlatform = () => {
    if (pendingPlatform) {
      window.open(pendingPlatform.baseUrl, "_blank");
      setDialogOpen(false);
      setPendingPlatform(null);
    }
  };

  const handleRunAndClose = (platform: Platform, baseUrl: string) => {
    setSheetOpen(false);
    handleRun(platform, baseUrl);
  };

  // Get media platforms based on prompt type (only if not using clone branding)
  const mediaPlatforms = useCloneBranding ? [] : (promptType === "IMAGE" ? imagePlatforms : promptType === "VIDEO" ? videoPlatforms : imagePlatforms);
  const isMediaPrompt = promptType === "IMAGE" || promptType === "VIDEO";

  // Get platforms based on active tab, merge with media platforms
  // Sponsors go to top, then rest sorted alphabetically
  const basePlatforms = activeTab === "code" ? codePlatforms : chatPlatforms;
  const sortedBasePlatforms = [...basePlatforms].sort((a, b) => {
    // Sponsors first (unless useCloneBranding is true)
    if (!useCloneBranding) {
      if (a.sponsor && !b.sponsor) return -1;
      if (!a.sponsor && b.sponsor) return 1;
    }
    return a.name.localeCompare(b.name);
  });
  
  const activePlatforms = isMediaPrompt
    ? [...mediaPlatforms, ...sortedBasePlatforms]
    : [...sortedBasePlatforms, ...mediaPlatforms].sort((a, b) => {
        if (!useCloneBranding) {
          if (a.sponsor && !b.sponsor) return -1;
          if (!a.sponsor && b.sponsor) return 1;
        }
        return a.name.localeCompare(b.name);
      });

  // Render platform item for mobile
  const renderMobilePlatform = (platform: Platform) => {
    if (platform.subOptions) {
      return (
        <div key={platform.id} className="space-y-1">
          <div className="flex items-center gap-3 px-3 py-2 text-base text-muted-foreground">
            {platform.sponsor && !useCloneBranding ? (
              <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
            ) : (
              <Zap className="h-4 w-4 text-green-500" />
            )}
            {platform.name}
          </div>
          <div className="pl-6 space-y-1">
            {platform.subOptions.map((option) => (
              <button
                key={option.baseUrl}
                onClick={() => handleRunAndClose(platform, option.baseUrl)}
                className="flex items-center gap-3 w-full px-3 py-3 text-base hover:bg-accent rounded-md text-left"
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <button
        key={platform.id}
        onClick={() => handleRunAndClose(platform, platform.baseUrl)}
        className="flex items-center gap-3 w-full px-3 py-3 text-base hover:bg-accent rounded-md text-left"
      >
        {platform.sponsor && !useCloneBranding ? (
          <Heart className="h-4 w-4 text-pink-500 fill-pink-500" />
        ) : platform.supportsQuerystring === false ? (
          <Clipboard className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Zap className="h-4 w-4 text-green-500" />
        )}
        {platform.name}
      </button>
    );
  };

  // Render platform item for desktop dropdown
  const renderDropdownPlatform = (platform: Platform) => {
    if (platform.subOptions) {
      return (
        <DropdownMenuSub key={platform.id}>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            {platform.sponsor && !useCloneBranding ? (
              <Heart className="h-3 w-3 text-pink-500 fill-pink-500" />
            ) : (
              <Zap className="h-3 w-3 text-green-500" />
            )}
            {platform.name}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {platform.subOptions.map((option) => (
              <DropdownMenuItem
                key={option.baseUrl}
                onClick={() => handleRun(platform, option.baseUrl)}
              >
                {option.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      );
    }
    return (
      <DropdownMenuItem
        key={platform.id}
        onClick={() => handleRun(platform, platform.baseUrl)}
        className="flex items-center gap-2"
      >
        {platform.sponsor && !useCloneBranding ? (
          <Heart className="h-3 w-3 text-pink-500 fill-pink-500" />
        ) : platform.supportsQuerystring === false ? (
          <Clipboard className="h-3 w-3 text-muted-foreground" />
        ) : (
          <Zap className="h-3 w-3 text-green-500" />
        )}
        {platform.name}
      </DropdownMenuItem>
    );
  };

  // Tab buttons render function
  const renderTabButtons = (size: "default" | "small" = "default") => (
    <div className={`flex gap-1 ${size === "small" ? "p-1" : "p-1.5"} bg-muted rounded-md`}>
      <button
        onClick={() => setActiveTab("chat")}
        className={`flex-1 ${size === "small" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} font-medium rounded transition-colors ${
          activeTab === "chat"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Chat
      </button>
      <button
        onClick={() => setActiveTab("code")}
        className={`flex-1 ${size === "small" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} font-medium rounded transition-colors ${
          activeTab === "code"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Code
      </button>
    </div>
  );

  return (
    <>
      {/* Mobile: Bottom Sheet */}
      {isMobile ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant={emphasized ? undefined : variant} size={size} className={emphasized ? `bg-green-600 hover:bg-green-700 text-white ${className || ""}` : className}>
              <Play className="h-4 w-4" />
              {size !== "icon" && <span className="ml-1.5">{t("run")}</span>}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>{t("run")}</SheetTitle>
            </SheetHeader>
            <div className="py-2">
              {renderTabButtons()}
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              {activePlatforms.map(renderMobilePlatform)}
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        /* Desktop: Dropdown */
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={emphasized ? undefined : variant} size={size} className={emphasized ? `bg-green-600 hover:bg-green-700 text-white ${className || ""}` : className}>
              <Play className="h-4 w-4" />
              {size !== "icon" && <span className="ml-1.5">{t("run")}</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="p-1">
              {renderTabButtons("small")}
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-64 overflow-y-auto">
              {activePlatforms.map(renderDropdownPlatform)}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("promptCopied")}</DialogTitle>
            <DialogDescription>
              {t("promptCopiedDescription", { platform: pendingPlatform?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleOpenPlatform}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("openPlatform", { platform: pendingPlatform?.name ?? "" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variable Fill Dialog */}
      <Dialog open={variableDialogOpen} onOpenChange={setVariableDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tCommon("fillVariables")}</DialogTitle>
            <DialogDescription>
              {tCommon("fillVariablesDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {unfilledVariables.map((variable) => (
              <div key={variable.name} className="space-y-2">
                <label htmlFor={`run-var-${variable.name}`} className="text-sm font-medium">
                  {variable.name}
                </label>
                <input
                  id={`run-var-${variable.name}`}
                  type="text"
                  value={variableValues[variable.name] || ""}
                  onChange={(e) => setVariableValues(prev => ({ ...prev, [variable.name]: e.target.value }))}
                  placeholder={variable.defaultValue || variable.name}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariableDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleVariableSubmit}>
              <Play className="h-4 w-4 mr-2" />
              {t("run")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
