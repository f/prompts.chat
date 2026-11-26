"use client";

import Link from "next/link";
import { SubscribeButton } from "./subscribe-button";

interface CategoryItemProps {
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    promptCount: number;
  };
  isSubscribed: boolean;
  showSubscribe: boolean;
}

export function CategoryItem({ category, isSubscribed, showSubscribe }: CategoryItemProps) {
  return (
    <div className="group flex cursor-pointer items-center justify-between gap-2 border rounded-[var(--radius)] px-3 py-2 bg-card hover:bg-accent/50 transition-colors">
      <Link
        href={`/categories/${category.slug}`}
        className="flex items-center gap-2 min-w-0 flex-1"
      >
        {category.icon && (
          <span className="text-sm shrink-0">{category.icon}</span>
        )}
        <span className="text-sm font-medium truncate group-hover:underline">
          {category.name}
        </span>
      </Link>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">
          {category.promptCount}
        </span>
        {showSubscribe && (
          <SubscribeButton
            categoryId={category.id}
            categoryName={category.name}
            initialSubscribed={isSubscribed}
            iconOnly
          />
        )}
      </div>
    </div>
  );
}
