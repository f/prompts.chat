import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface PromptAuthorData {
  username: string;
  name?: string | null;
  avatar?: string | null;
  verified?: boolean;
}

interface PromptAuthorProps {
  author: PromptAuthorData;
  /** "sm" for card footers, "md" for page headers */
  size?: "sm" | "md";
  className?: string;
}

/** The author's avatar and @username, linking to their profile, as shown on prompt, bot and team cards */
export function PromptAuthor({ author, size = "sm", className }: PromptAuthorProps) {
  const initial = (author.name || author.username).charAt(0).toUpperCase();
  return (
    <Link
      href={`/@${author.username}`}
      prefetch={false}
      className={cn(
        "flex min-w-0 items-center hover:text-foreground",
        size === "sm" ? "gap-1.5" : "gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      <Avatar className={size === "sm" ? "h-4 w-4" : "h-5 w-5"}>
        <AvatarImage src={author.avatar || undefined} alt={author.username} />
        <AvatarFallback className={size === "sm" ? "text-[8px]" : "text-[10px]"}>{initial}</AvatarFallback>
      </Avatar>
      <span className="truncate">@{author.username}</span>
      {author.verified && <BadgeCheck className={cn("shrink-0 text-primary", size === "sm" ? "h-3 w-3 mt-0.5" : "h-3.5 w-3.5")} />}
    </Link>
  );
}
