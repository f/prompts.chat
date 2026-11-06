import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclosureProps {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  summaryClassName?: string;
  contentClassName?: string;
}

export function Disclosure({ summary, children, className, summaryClassName, contentClassName }: DisclosureProps) {
  return (
    <details className={cn("group", className)}>
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground select-none hover:text-foreground [&::-webkit-details-marker]:hidden",
          summaryClassName
        )}
      >
        <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90" aria-hidden />
        {summary}
      </summary>
      <div className={contentClassName}>{children}</div>
    </details>
  );
}
