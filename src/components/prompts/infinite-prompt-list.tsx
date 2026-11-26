"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, SearchX, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Masonry } from "@/components/ui/masonry";
import { useFilterContext } from "./filter-context";
import { PromptCard, type PromptCardProps } from "./prompt-card";
import { WidgetCard } from "./widget-card";
import { injectWidgets, isWidget } from "@/lib/plugins/widgets";

interface InfinitePromptListProps {
  initialPrompts: PromptCardProps["prompt"][];
  initialTotal: number;
  filters: {
    q?: string;
    type?: string;
    category?: string;
    categorySlug?: string;
    tag?: string; 
    sort?: string;
    trending?: string;
  };
  /** Heading of the empty state; defaults to "No prompts found" */
  emptyTitle?: string;
}

function PromptCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function InfinitePromptList({ 
  initialPrompts, 
  initialTotal,
  filters,
  emptyTitle,
}: InfinitePromptListProps) {
  const t = useTranslations("prompts");
  const _searchParams = useSearchParams();
  const { isFilterPending, setFilterPending } = useFilterContext();
  const [prompts, setPrompts] = useState(initialPrompts);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPrompts.length < initialTotal);
  const [hasError, setHasError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Set mounted state after hydration
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Reset when new data arrives from server
  useEffect(() => {
    // Cancel any in-flight request when filters change
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setPrompts(initialPrompts);
    setPage(1);
    setHasMore(initialPrompts.length < initialTotal);
    setHasError(false);
    setFilterPending(false);
  }, [initialPrompts, initialTotal, setFilterPending]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setHasError(false);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams();
      params.set("page", nextPage.toString());
      if (filters.q) params.set("q", filters.q);
      if (filters.type) params.set("type", filters.type);
      if (filters.category) params.set("category", filters.category);
      if (filters.tag) params.set("tag", filters.tag);
      if (filters.sort) params.set("sort", filters.sort);
      if (filters.trending) params.set("trending", filters.trending);

      const response = await fetch(`/api/prompts?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      
      // Deduplicate by ID to prevent duplicate key errors
      setPrompts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newPrompts = data.prompts.filter((p: { id: string }) => !existingIds.has(p.id));
        // Calculate hasMore using updated length
        const newTotal = prev.length + newPrompts.length;
        setHasMore(data.prompts.length > 0 && newTotal < data.total);
        return [...prev, ...newPrompts];
      });
      setPage(nextPage);
    } catch (error) {
      // Ignore abort errors - they're expected when cancelling requests
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Failed to load more prompts:", error);
      setHasError(true);
    } finally {
      // Only clear loading if this controller is still active
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  }, [isLoading, hasMore, page, filters]);

  // Intersection Observer for infinite scroll (disabled if there was an error)
  useEffect(() => {
    if (hasError) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoading, hasError]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Show skeleton while filtering
  if (isFilterPending) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <PromptCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <SearchX className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">{emptyTitle ?? t("noPrompts")}</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("noPromptsDescription")}
        </p>
      </div>
    );
  }

  // Inject widgets into the prompt list (widgets decide their own injection logic)
  // Only inject after mount to prevent hydration mismatch
  const itemsToRender = isMounted ? injectWidgets(prompts, { filters }) : prompts;

  return (
    <div className="space-y-4">
      <Masonry columnCount={{ default: 1, md: 2, lg: 2, xl: 3 }} gap={16}>
        {itemsToRender.map((item) => 
          isWidget(item) ? (
            <WidgetCard key={item.id} prompt={item} />
          ) : (
            <PromptCard key={item.id} prompt={item} />
          )
        )}
      </Masonry>

      {/* Loader / End indicator / Error state */}
      <div ref={loaderRef} className="flex items-center justify-center py-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loading")}
          </div>
        )}
        {!isLoading && hasError && hasMore && (
          <Button variant="outline" size="sm" onClick={loadMore}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("loadMore")}
          </Button>
        )}
        {!hasMore && prompts.length > 0 && (
          <p className="text-xs text-muted-foreground">{t("noMorePrompts")}</p>
        )}
      </div>
    </div>
  );
}
