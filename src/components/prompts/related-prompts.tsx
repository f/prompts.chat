import Link from "next/link";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getBotUrl, getPromptUrl } from "@/lib/urls";
import { UpvoteCount } from "@/components/prompts/upvote-count";

interface RelatedPrompt {
  id: string;
  title: string;
  slug: string | null;
  description: string | null;
  type: string;
  author: {
    id: string;
    name: string | null;
    username: string;
    avatar: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  _count: {
    votes: number;
  };
}

interface RelatedPromptsProps {
  prompts: RelatedPrompt[];
  /** Defaults to "Related Prompts" */
  title?: string;
}

export function RelatedPrompts({ prompts, title }: RelatedPromptsProps) {
  const t = useTranslations("prompts");

  if (prompts.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{title ?? t("relatedPrompts")}</h2>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {prompts.map((prompt) => (
          <Link
            key={prompt.id}
            href={prompt.type === "BOT" ? getBotUrl(prompt.id, prompt.slug) : getPromptUrl(prompt.id, prompt.slug)}
            className="group border rounded-[var(--radius)] p-4 hover:border-foreground/20 transition-colors flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-medium text-sm line-clamp-1 group-hover:underline">
                {prompt.title}
              </h3>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {t(`types.${prompt.type.toLowerCase()}`)}
              </Badge>
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
              {prompt.description || "—"}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-2">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={prompt.author.avatar || undefined} />
                  <AvatarFallback className="text-[8px]">
                    {prompt.author.name?.[0] || prompt.author.username[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="shrink-0">
                  @{prompt.author.username}
                </span>
              </div>
              <UpvoteCount count={prompt._count.votes} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
