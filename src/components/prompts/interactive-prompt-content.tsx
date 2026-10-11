"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RunPromptButton } from "./run-prompt-button";
import { TranslateButton } from "./translate-button";
import { DownloadPromptDropdown } from "./download-prompt-dropdown";
import { ShareDropdown } from "./share-dropdown";
import { CodeView } from "@/components/ui/code-view";
import { CodeEditor } from "@/components/ui/code-editor";
import { prettifyJson } from "@/lib/format";

interface Variable {
  name: string;
  defaultValue: string;
  fullMatch: string;
}

interface InteractivePromptContentProps {
  content: string;
  className?: string;
  isStructured?: boolean;
  structuredFormat?: "json" | "yaml";
  title?: string;
  description?: string;
  isLoggedIn?: boolean;
  categoryName?: string;
  parentCategoryName?: string;
  promptId?: string;
  promptSlug?: string;
  promptType?: string;
  shareTitle?: string;
  promptTitle?: string;
  promptDescription?: string;
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

// Get unique variable names with their default values
function getUniqueVariables(variables: Variable[]): { name: string; defaultValue: string }[] {
  const seen = new Map<string, string>();
  for (const variable of variables) {
    if (!seen.has(variable.name)) {
      seen.set(variable.name, variable.defaultValue);
    }
  }
  return Array.from(seen.entries()).map(([name, defaultValue]) => ({ name, defaultValue }));
}

// Contenteditable span component
function EditableSpan({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isShowingPlaceholder, setIsShowingPlaceholder] = useState(!value);

  useEffect(() => {
    if (spanRef.current) {
      if (!value && !document.activeElement?.isSameNode(spanRef.current)) {
        // Show placeholder when empty and not focused
        spanRef.current.textContent = placeholder;
        // Sync state with DOM - intentional pattern
        queueMicrotask(() => setIsShowingPlaceholder(true));
      } else if (value && spanRef.current.textContent !== value) {
        spanRef.current.textContent = value;
        queueMicrotask(() => setIsShowingPlaceholder(false));
      }
    }
  }, [value, placeholder]);

  const handleInput = () => {
    if (spanRef.current) {
      const newValue = spanRef.current.textContent || "";
      onChange(newValue);
      setIsShowingPlaceholder(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleFocus = () => {
    if (spanRef.current && isShowingPlaceholder) {
      // Clear placeholder on focus
      spanRef.current.textContent = "";
      setIsShowingPlaceholder(false);
    }
  };

  const handleBlur = () => {
    if (spanRef.current) {
      const currentValue = spanRef.current.textContent || "";
      if (!currentValue.trim()) {
        // Refill with placeholder if empty on blur
        spanRef.current.textContent = placeholder;
        setIsShowingPlaceholder(true);
        onChange("");
      }
    }
  };

  return (
    <span
      ref={spanRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`inline border-b-2 px-1 rounded-sm outline-none min-w-[2ch] cursor-text ${
        isShowingPlaceholder
          ? "bg-primary/5 border-primary/20 text-muted-foreground/60"
          : "bg-primary/10 border-primary/40 focus:border-primary focus:bg-primary/15"
      }`}
    />
  );
}

/** Prompt body with variable editing, copy, download, and share actions. */
export function InteractivePromptContent({ 
  content, 
  className,
  isStructured = false,
  structuredFormat = "json",
  title,
  description,
  isLoggedIn = false,
  categoryName,
  parentCategoryName,
  promptId,
  promptSlug,
  promptType,
  shareTitle,
  promptTitle,
  promptDescription
}: InteractivePromptContentProps) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<string | null>(null);

  // Use translated content if available, otherwise use original
  const displayedContent = translatedContent || content;

  // Parse variables from content
  const variables = useMemo(() => parseVariables(content), [content]);
  const uniqueVariables = useMemo(() => getUniqueVariables(variables), [variables]);

  // Initialize values as empty strings (defaults are placeholders)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const variable of variables) {
      if (!(variable.name in initial)) {
        initial[variable.name] = variable.defaultValue;
      }
    }
    return initial;
  });

  // Check if any values have been modified from defaults
  const isModified = useMemo(() => {
    for (const { name, defaultValue } of uniqueVariables) {
      if (values[name] !== defaultValue) {
        return true;
      }
    }
    return false;
  }, [values, uniqueVariables]);

  // Reset all values to defaults
  const handleReset = useCallback(() => {
    const initial: Record<string, string> = {};
    for (const variable of variables) {
      if (!(variable.name in initial)) {
        initial[variable.name] = variable.defaultValue;
      }
    }
    setValues(initial);
  }, [variables]);

  // Get the final content with variables replaced
  const getFinalContent = useCallback(() => {
    let result = displayedContent;
    for (const variable of variables) {
      // Use the value if set, otherwise use default
      const value = values[variable.name] || variable.defaultValue;
      result = result.replace(variable.fullMatch, value);
    }
    return result;
  }, [displayedContent, variables, values]);

  // Get content with custom variable values (for RunPromptButton dialog)
  const getContentWithVariables = useCallback((customValues: Record<string, string>) => {
    let result = displayedContent;
    for (const variable of variables) {
      const value = customValues[variable.name] || values[variable.name] || variable.defaultValue;
      result = result.replace(variable.fullMatch, value);
    }
    return result;
  }, [displayedContent, variables, values]);

  // Get unfilled variables (empty current value and no default)
  const unfilledVariables = useMemo(() => {
    return uniqueVariables.filter(v => {
      const currentValue = values[v.name];
      return !currentValue || currentValue.trim() === "";
    }).map(v => ({ name: v.name, defaultValue: v.defaultValue }));
  }, [uniqueVariables, values]);

  // Handle variables filled from RunPromptButton dialog
  const handleVariablesFilled = useCallback((newValues: Record<string, string>) => {
    setValues(prev => ({ ...prev, ...newValues }));
  }, []);

  // Update a variable value
  const updateValue = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Copy to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getFinalContent());
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("failedToCopy"));
    }
  };

  // Prettify JSON content for display
  const displayContent = isStructured && structuredFormat === "json" 
    ? prettifyJson(displayedContent) 
    : displayedContent;

  // Handle translation callback
  const handleTranslate = useCallback((translated: string) => {
    setTranslatedContent(translated);
  }, []);

  // Check if this is a SKILL or TASTE type prompt
  const isSkill = promptType === "SKILL";
  const isTaste = promptType === "TASTE";

  // If no variables, render simple content
  if (variables.length === 0) {
    if (isSkill || isTaste) {
      // SKILL/TASTE type: render with Monaco editor (read-only markdown)
      return (
        <div className={className}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              <h3 className="text-base font-semibold">{isTaste ? "taste.md" : (title || "SKILL.md")}</h3>
              <TranslateButton
                content={content}
                onTranslate={handleTranslate}
                isLoggedIn={isLoggedIn}
              />
            </div>
            <div className="flex items-center gap-2">
              {promptId && <DownloadPromptDropdown promptId={promptId} promptSlug={promptSlug} promptType={promptType} />}
              {shareTitle && <ShareDropdown title={shareTitle} prompt={content} promptId={promptId} />}
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <CodeEditor
            value={displayedContent}
            onChange={() => {}}
            language="markdown"
            minHeight="400px"
            className="text-sm"
            readOnly={true}
          />
        </div>
      );
    }
    if (isStructured) {
      return (
        <div className={className}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1">
              {title && <h3 className="text-base font-semibold">{title}</h3>}
              <TranslateButton
                content={content}
                onTranslate={handleTranslate}
                isLoggedIn={isLoggedIn}
              />
            </div>
            <div className="flex items-center gap-2">
              {promptId && <DownloadPromptDropdown promptId={promptId} promptSlug={promptSlug} promptType={promptType} />}
              {shareTitle && <ShareDropdown title={shareTitle} prompt={content} promptId={promptId} />}
              <Button variant="ghost" size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <RunPromptButton 
                content={displayContent}
                title={promptTitle || title}
                description={promptDescription || description}
                unfilledVariables={unfilledVariables}
                onVariablesFilled={handleVariablesFilled}
                getContentWithVariables={getContentWithVariables}
                categoryName={categoryName}
                parentCategoryName={parentCategoryName}
                promptType={promptType as "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STRUCTURED" | "SKILL"}
                emphasized
              />
            </div>
          </div>
          <CodeView 
            content={displayContent} 
            language={structuredFormat}
            className="text-sm"
            wordWrap
          />
        </div>
      );
    }
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            {title && <h3 className="text-base font-semibold">{title}</h3>}
            <TranslateButton
              content={content}
              onTranslate={handleTranslate}
              isLoggedIn={isLoggedIn}
            />
          </div>
          <div className="flex items-center gap-2">
            {promptId && <DownloadPromptDropdown promptId={promptId} promptSlug={promptSlug} promptType={promptType} />}
            {shareTitle && <ShareDropdown title={shareTitle} prompt={content} promptId={promptId} />}
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <RunPromptButton 
              content={displayedContent}
              title={promptTitle || title}
              description={promptDescription || description}
              unfilledVariables={unfilledVariables}
              onVariablesFilled={handleVariablesFilled}
              getContentWithVariables={getContentWithVariables}
              categoryName={categoryName}
              parentCategoryName={parentCategoryName}
              promptType={promptType as "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STRUCTURED" | "SKILL"}
              emphasized
            />
          </div>
        </div>
        <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg font-mono border max-h-[500px] overflow-y-auto">
          {displayedContent}
        </pre>
      </div>
    );
  }

  // For structured prompts, render form above code view
  if (isStructured) {
    return (
      <div className={className}>
        {/* Header with title and action buttons */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            {title && <h3 className="text-base font-semibold">{title}</h3>}
            <TranslateButton
              content={content}
              onTranslate={handleTranslate}
              isLoggedIn={isLoggedIn}
            />
          </div>
          <div className="flex items-center gap-2">
            {isModified && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
                <RotateCcw className="h-3 w-3 mr-1" />
                {t("reset")}
              </Button>
            )}
            {promptId && <DownloadPromptDropdown promptId={promptId} promptSlug={promptSlug} promptType={promptType} />}
            {shareTitle && <ShareDropdown title={shareTitle} prompt={content} promptId={promptId} />}
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <RunPromptButton 
              content={getFinalContent()}
              title={promptTitle || title}
              description={promptDescription || description}
              unfilledVariables={unfilledVariables}
              onVariablesFilled={handleVariablesFilled}
              getContentWithVariables={getContentWithVariables}
              categoryName={categoryName}
              parentCategoryName={parentCategoryName}
              promptType={promptType as "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STRUCTURED" | "SKILL"}
              emphasized
            />
          </div>
        </div>
        {/* Variable form */}
        <div className="mb-4 p-4 rounded-lg border bg-muted/30 space-y-3">
          <span className="text-sm font-medium">{t("variables")}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {uniqueVariables.map(({ name, defaultValue }) => (
              <div key={name} className="space-y-1">
                <Label htmlFor={`var-${name}`} className="text-xs text-muted-foreground">
                  {name}
                </Label>
                <Input
                  id={`var-${name}`}
                  value={values[name] || ""}
                  onChange={(e) => updateValue(name, e.target.value)}
                  placeholder={defaultValue}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        </div>
        {/* Code view with replaced variables */}
        <CodeView 
          content={getFinalContent()} 
          language={structuredFormat}
          className="text-sm"
          wordWrap
        />
      </div>
    );
  }

  // Render content with inline contenteditable spans
  const renderContent = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /\$\{([^:}]+)(?::([^}]*))?\}/g;
    let match;
    let keyIndex = 0;

    while ((match = regex.exec(displayedContent)) !== null) {
      // Add text before the variable
      if (match.index > lastIndex) {
        parts.push(displayedContent.slice(lastIndex, match.index));
      }

      const name = match[1].trim();
      const currentValue = values[name] || "";

      // Add contenteditable span
      parts.push(
        <EditableSpan
          key={keyIndex++}
          value={currentValue}
          onChange={(newValue) => updateValue(name, newValue)}
          placeholder={name}
        />
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < displayedContent.length) {
      parts.push(displayedContent.slice(lastIndex));
    }

    return parts;
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          {title && <h3 className="text-base font-semibold">{title}</h3>}
          <TranslateButton
            content={content}
            onTranslate={handleTranslate}
            isLoggedIn={isLoggedIn}
          />
        </div>
        <div className="flex items-center gap-2">
          {isModified && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 px-2 text-xs">
              <RotateCcw className="h-3 w-3 mr-1" />
              {t("reset")}
            </Button>
          )}
          {promptId && <DownloadPromptDropdown promptId={promptId} promptSlug={promptSlug} promptType={promptType} />}
          {shareTitle && <ShareDropdown title={shareTitle} prompt={content} promptId={promptId} />}
          <Button variant="ghost" size="sm" onClick={copyToClipboard}>
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <RunPromptButton 
            content={getFinalContent()}
            title={promptTitle || title}
            description={promptDescription || description}
            unfilledVariables={unfilledVariables}
            onVariablesFilled={handleVariablesFilled}
            getContentWithVariables={getContentWithVariables}
            categoryName={categoryName}
            parentCategoryName={parentCategoryName}
            promptType={promptType as "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "STRUCTURED" | "SKILL"}
            emphasized
          />
        </div>
      </div>
      {/* Variable form for text prompts */}
      <div className="mb-4 p-4 rounded-lg border bg-muted/30 space-y-3">
        <span className="text-sm font-medium">{t("variables")}</span>
        <div className="grid gap-3 sm:grid-cols-2">
          {uniqueVariables.map(({ name, defaultValue }) => (
            <div key={name} className="space-y-1">
              <Label htmlFor={`var-text-${name}`} className="text-xs text-muted-foreground">
                {name}
              </Label>
              <Input
                id={`var-text-${name}`}
                value={values[name] || ""}
                onChange={(e) => updateValue(name, e.target.value)}
                placeholder={defaultValue}
                className="h-8 text-sm"
              />
            </div>
          ))}
        </div>
      </div>
      <div className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg font-mono border leading-relaxed max-h-[500px] overflow-y-auto">
        {renderContent()}
      </div>
    </div>
  );
}
