import { ArrowBigUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpvoteIconProps {
  voted?: boolean;
  className?: string;
}

export function UpvoteIcon({ voted = false, className }: UpvoteIconProps) {
  return (
    <ArrowBigUp
      aria-hidden="true"
      className={cn("h-3.5 w-3.5 shrink-0", voted && "fill-current", className)}
    />
  );
}

interface UpvoteCountProps {
  count: number;
  voted?: boolean;
  className?: string;
}

/** Inherits font size and color from its container so it matches the card footer it sits in */
export function UpvoteCount({ count, voted = false, className }: UpvoteCountProps) {
  return (
    <span className={cn("flex shrink-0 items-center gap-0.5", voted && "text-primary", className)}>
      <UpvoteIcon voted={voted} />
      {count}
    </span>
  );
}
