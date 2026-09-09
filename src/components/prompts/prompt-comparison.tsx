"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ArrowRightLeft, Sparkles, Sliders } from "lucide-react";
import { toast } from "sonner";

interface PromptComparisonProps {
  initialPromptA?: string;
  initialPromptB?: string;
  title?: string;
}

export function PromptComparison({
  initialPromptA = "Act as a Senior Software Engineer. Review the following code for security, performance, and best practices. Provide actionable feedback with examples.",
  initialPromptB = "You are a Principal Software Architect. Perform a rigorous code review focusing on architectural integrity, micro-optimizations, OWASP vulnerabilities, and design patterns. Output structured markdown.",
  title = "Prompt Comparison Studio",
}: PromptComparisonProps) {
  const [promptA, setPromptA] = useState(initialPromptA);
  const [promptB, setPromptB] = useState(initialPromptB);
  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);
  const [temperature, setTemperature] = useState(0.7);

  const copyToClipboard = (text: string, isA: boolean) => {
    navigator.clipboard.writeText(text);
    if (isA) {
      setCopiedA(true);
      setTimeout(() => setCopiedA(false), 2000);
    } else {
      setCopiedB(true);
      setTimeout(() => setCopiedB(false), 2000);
    }
    toast.success("Prompt copied to clipboard!");
  };

  const swapPrompts = () => {
    const temp = promptA;
    setPromptA(promptB);
    setPromptB(temp);
    toast.info("Prompts swapped");
  };

  return (
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Side-by-side prompt variation comparison and parameter simulation
          </p>
        </div>
        <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border text-xs">
          <Sliders className="w-4 h-4 text-indigo-500" />
          <span className="font-medium">Temp: {temperature}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-24 accent-indigo-600 cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
        {/* Swap Action Button */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <Button
            variant="outline"
            size="icon"
            onClick={swapPrompts}
            className="rounded-full shadow-lg border-primary/20 bg-background hover:bg-muted glow-hover"
            title="Swap Prompts"
          >
            <ArrowRightLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Prompt Variant A */}
        <Card className="glass-card shadow-sm border-indigo-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-indigo-600 hover:bg-indigo-700">
                  Variant A
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {promptA.length} chars | {promptA.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(promptA, true)}
                className="h-8 gap-1 text-xs"
              >
                {copiedA ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedA ? "Copied" : "Copy"}
              </Button>
            </div>
            <CardTitle className="text-base font-semibold mt-2">Baseline Prompt</CardTitle>
            <CardDescription className="text-xs">
              Standard structured instruction formulation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={promptA}
              onChange={(e) => setPromptA(e.target.value)}
              placeholder="Enter variant A prompt..."
              rows={8}
              className="font-mono text-xs leading-relaxed resize-y bg-background/50 border-muted"
            />
          </CardContent>
        </Card>

        {/* Prompt Variant B */}
        <Card className="glass-card shadow-sm border-purple-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  Variant B
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {promptB.length} chars | {promptB.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(promptB, false)}
                className="h-8 gap-1 text-xs"
              >
                {copiedB ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedB ? "Copied" : "Copy"}
              </Button>
            </div>
            <CardTitle className="text-base font-semibold mt-2">Enhanced / Persona Prompt</CardTitle>
            <CardDescription className="text-xs">
              Persona-focused or detailed constraint formulation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={promptB}
              onChange={(e) => setPromptB(e.target.value)}
              placeholder="Enter variant B prompt..."
              rows={8}
              className="font-mono text-xs leading-relaxed resize-y bg-background/50 border-muted"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
