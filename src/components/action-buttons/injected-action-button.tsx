"use client";

import { useState } from "react";
import { Clipboard, ExternalLink, Zap } from "lucide-react";
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { analyticsActionButton } from "@/lib/analytics";
import { buildUrl, type Platform } from "@/lib/run-platforms";
import {
  buildActionPrompt,
  getActionButtonAgents,
  type ActionButtonConfig,
} from "@/lib/plugins/action-buttons";
import { cn } from "@/lib/utils";
import { ActionButtonTrigger, useActionButtonLabel } from "./action-button-trigger";

interface UnfilledVariable {
  name: string;
  defaultValue: string;
}

interface PendingLaunch {
  platform: Platform;
  baseUrl: string;
}

interface InjectedActionButtonProps {
  action: ActionButtonConfig;
  content: string;
  title?: string;
  description?: string;
  promptId?: string;
  compact?: boolean;
  className?: string;
  unfilledVariables?: UnfilledVariable[];
  onVariablesFilled?: (values: Record<string, string>) => void;
  getContentWithVariables?: (values: Record<string, string>) => string;
}

export function InjectedActionButton({
  action,
  content,
  title,
  description,
  promptId,
  compact = false,
  className,
  unfilledVariables = [],
  onVariablesFilled,
  getContentWithVariables,
}: InjectedActionButtonProps) {
  const t = useTranslations("prompts");
  const tCommon = useTranslations("common");
  const label = useActionButtonLabel(action);
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [copiedPlatform, setCopiedPlatform] = useState<PendingLaunch | null>(null);
  const [variablePlatform, setVariablePlatform] = useState<PendingLaunch | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const agents = getActionButtonAgents(action);

  const launch = ({ platform, baseUrl }: PendingLaunch, promptContent: string) => {
    const text = buildActionPrompt(action, promptContent);
    analyticsActionButton.click(action.id, promptId, platform.name);

    if (platform.supportsQuerystring === false) {
      navigator.clipboard.writeText(text);
      setCopiedPlatform({ platform, baseUrl });
      return;
    }

    const url = buildUrl(platform.id, baseUrl, text, title, description);
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.open(url, "_blank");
    } else {
      // eslint-disable-next-line react-hooks/immutability -- Valid browser navigation for custom URL schemes
      window.location.href = url;
    }
  };

  const handleSelect = (platform: Platform, baseUrl: string) => {
    setSheetOpen(false);
    if (unfilledVariables.length > 0) {
      setVariableValues(Object.fromEntries(unfilledVariables.map((v) => [v.name, v.defaultValue])));
      setVariablePlatform({ platform, baseUrl });
      return;
    }
    launch({ platform, baseUrl }, content);
  };

  const handleVariableSubmit = () => {
    if (!variablePlatform) return;
    onVariablesFilled?.(variableValues);
    const finalContent = getContentWithVariables ? getContentWithVariables(variableValues) : content;
    setVariablePlatform(null);
    launch(variablePlatform, finalContent);
  };

  const platformIcon = (platform: Platform, size: string) =>
    platform.supportsQuerystring === false ? (
      <Clipboard className={cn(size, "text-muted-foreground")} />
    ) : (
      <Zap className={cn(size, "text-green-500")} />
    );

  const renderDropdownAgent = (platform: Platform) => {
    if (platform.subOptions) {
      return (
        <DropdownMenuSub key={platform.id}>
          <DropdownMenuSubTrigger className="flex items-center gap-2">
            {platformIcon(platform, "h-3 w-3")}
            {platform.name}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {platform.subOptions.map((option) => (
              <DropdownMenuItem key={option.baseUrl} onClick={() => handleSelect(platform, option.baseUrl)}>
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
        onClick={() => handleSelect(platform, platform.baseUrl)}
        className="flex items-center gap-2"
      >
        {platformIcon(platform, "h-3 w-3")}
        {platform.name}
      </DropdownMenuItem>
    );
  };

  const renderMobileAgent = (platform: Platform) => {
    const options = platform.subOptions ?? [{ name: platform.name, baseUrl: platform.baseUrl }];
    return options.map((option) => (
      <button
        key={option.baseUrl}
        onClick={() => handleSelect(platform, option.baseUrl)}
        className="flex items-center gap-3 w-full px-3 py-3 text-base hover:bg-accent rounded-md text-left"
      >
        {platformIcon(platform, "h-4 w-4")}
        {option.name}
      </button>
    ));
  };

  const trigger = <ActionButtonTrigger action={action} compact={compact} className={className} />;

  return (
    <>
      {isMobile ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>{label}</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto flex-1 py-2">{agents.map(renderMobileAgent)}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <div className="max-h-64 overflow-y-auto">{agents.map(renderDropdownAgent)}</div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={!!copiedPlatform} onOpenChange={(open) => !open && setCopiedPlatform(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("promptCopied")}</DialogTitle>
            <DialogDescription>
              {t("promptCopiedDescription", { platform: copiedPlatform?.platform.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopiedPlatform(null)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => {
                if (copiedPlatform) window.open(copiedPlatform.baseUrl, "_blank");
                setCopiedPlatform(null);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("openPlatform", { platform: copiedPlatform?.platform.name ?? "" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!variablePlatform} onOpenChange={(open) => !open && setVariablePlatform(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tCommon("fillVariables")}</DialogTitle>
            <DialogDescription>{tCommon("fillVariablesDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {unfilledVariables.map((variable) => (
              <div key={variable.name} className="space-y-2">
                <label htmlFor={`action-var-${variable.name}`} className="text-sm font-medium">
                  {variable.name}
                </label>
                <input
                  id={`action-var-${variable.name}`}
                  type="text"
                  value={variableValues[variable.name] || ""}
                  onChange={(e) => setVariableValues((prev) => ({ ...prev, [variable.name]: e.target.value }))}
                  placeholder={variable.defaultValue || variable.name}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariablePlatform(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleVariableSubmit}>{label}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
