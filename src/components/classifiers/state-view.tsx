import { cn } from "@/lib/utils";
import type { ClassifierState } from "@/lib/classifiers";

export function formatState(state: ClassifierState): string {
  return typeof state === "string" ? state : JSON.stringify(state, null, 2);
}

export function StateView({ state, className }: { state: ClassifierState; className?: string }) {
  return (
    <pre
      className={cn(
        "max-h-72 overflow-auto rounded-[var(--radius)] border bg-muted/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words",
        className
      )}
    >
      {formatState(state)}
    </pre>
  );
}
