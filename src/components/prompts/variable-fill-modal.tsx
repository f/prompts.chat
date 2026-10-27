"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RunPromptButton } from "@/components/prompts/run-prompt-button";
import { InjectedActionButton } from "@/components/action-buttons/injected-action-button";
import type { ActionButtonConfig } from "@/lib/plugins/action-buttons";
import { analyticsPrompt } from "@/lib/analytics";

interface Variable {
  name: string;
  defaultValue: string;
  fullMatch: string;
}

interface VariableFillModalProps {
  content: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "copy" | "run";
  promptId?: string;
  categoryName?: string;
  parentCategoryName?: string;
  actionButton?: ActionButtonConfig;
}

// Parse ${variablename:defaultvalue} or ${variablename} patterns
function parseVariables(content: string): Variable[] {
  const regex = /\$\{([^:}]+)(?::([^}]*))?\}/g;
  const variables: Variable[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    variables.push({
      name: match[1].trim(),
      defaultValue: (match[2] ?? "").trim(),
      fullMatch: match[0],
    });
  }

  return variables;
}

// Get unique variables with their default values
function getUniqueVariables(variables: Variable[]): { name: string; defaultValue: string }[] {
  const seen = new Map<string, string>();
  for (const variable of variables) {
    if (!seen.has(variable.name)) {
      seen.set(variable.name, variable.defaultValue);
    }
  }
  return Array.from(seen.entries()).map(([name, defaultValue]) => ({ name, defaultValue }));
}

export function VariableFillModal({ 
  content, 
  open, 
  onOpenChange, 
  mode,
  promptId,
  categoryName,
  parentCategoryName,
  actionButton
}: VariableFillModalProps) {
  const t = useTranslations("common");

  // Parse variables from content
  const variables = useMemo(() => parseVariables(content), [content]);
  const uniqueVariables = useMemo(() => getUniqueVariables(variables), [variables]);

  // Initialize values with defaults
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const { name, defaultValue } of uniqueVariables) {
      initial[name] = defaultValue;
    }
    return initial;
  });

  // Get the final content with variables replaced
  const getFinalContent = useCallback(() => {
    let result = content;
    for (const variable of variables) {
      const value = values[variable.name] || variable.defaultValue;
      result = result.replace(variable.fullMatch, value);
    }
    return result;
  }, [content, variables, values]);

  // Update a variable value
  const updateValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Handle copy
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getFinalContent());
      analyticsPrompt.fillVariables(promptId);
      analyticsPrompt.copy(promptId);
      toast.success(t("copied"));
      onOpenChange(false);
    } catch {
      toast.error(t("failedToCopy"));
    }
  };

  const finalContent = getFinalContent();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t("variables")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {uniqueVariables.map(({ name, defaultValue }) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={`modal-var-${name}`} className="text-xs text-muted-foreground">
                {name}
              </Label>
              <Input
                id={`modal-var-${name}`}
                value={values[name] || ""}
                onChange={(e) => updateValue(name, e.target.value)}
                placeholder={defaultValue}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {mode === "copy" ? (
            <Button onClick={handleCopy} size="sm">
              <Copy className="h-4 w-4 mr-1.5" />
              {t("copy")}
            </Button>
          ) : actionButton ? (
            <InjectedActionButton action={actionButton} content={finalContent} promptId={promptId} />
          ) : (
            <RunPromptButton content={finalContent} size="sm" categoryName={categoryName} parentCategoryName={parentCategoryName} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Check if content has variables
export function hasVariables(content: string): boolean {
  return /\$\{[^:}]+(?::[^}]*)?\}/.test(content);
}

// Render content with styled variable placeholders (non-editable)
export function renderContentWithVariables(content: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const regex = /\$\{([^:}]+)(?::([^}]*))?\}/g;
  let match;
  let keyIndex = 0;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the variable
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const name = match[1].trim();
    const defaultValue = (match[2] ?? "").trim();

    // Add styled variable badge showing default value or name
    parts.push(
      <span
        key={keyIndex++}
        className="inline-block px-1 py-0.5 mx-0.5 rounded bg-primary/15 text-primary text-[10px] font-medium"
      >
        {defaultValue || name}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}
