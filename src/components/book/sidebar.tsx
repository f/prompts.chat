"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { parts } from "@/lib/book/chapters";
import { Book, Bookmark, List, Search, X, Globe, Heart, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setLocale } from "@/lib/i18n/client";
import { getBookPdfLocale, localeMetadata } from "@/lib/i18n/locales";

const BOOKMARK_KEY = "book-reading-progress";

function useBookmark() {
  const [bookmark, setBookmark] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(BOOKMARK_KEY);
    if (saved) setBookmark(saved);
  }, []);

  const saveBookmark = useCallback((slug: string) => {
    localStorage.setItem(BOOKMARK_KEY, slug);
    setBookmark(slug);
  }, []);

  const clearBookmark = useCallback(() => {
    localStorage.removeItem(BOOKMARK_KEY);
    setBookmark(null);
  }, []);

  return { bookmark, saveBookmark, clearBookmark };
}

export { useBookmark, BOOKMARK_KEY };

function SidebarContent({ onNavigate, searchQuery = "", bookmark, onBookmark }: { 
  onNavigate?: () => void; 
  searchQuery?: string;
  bookmark?: string | null;
  onBookmark?: (slug: string) => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("book");
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null);

  const getPartTitle = (part: typeof parts[0]) => {
    const partKeys: Record<string, string> = {
      "introduction": "introduction",
      "part-i-foundations": "foundations",
      "part-ii-techniques": "techniques",
      "part-iii-advanced": "advanced",
      "part-iv-best-practices": "bestPractices",
      "part-v-use-cases": "useCases",
      "part-vi-conclusion": "conclusion",
    };
    const key = partKeys[part.slug];
    if (key) {
      try {
        return t(`parts.${key}`);
      } catch {
        return part.title;
      }
    }
    return part.title;
  };

  const getChapterTitle = (slug: string, fallback: string) => {
    try {
      return t(`chapters.${slug}`);
    } catch {
      return fallback;
    }
  };

  // Filter parts and chapters based on search query
  const filteredParts = useMemo(() => {
    if (!searchQuery.trim()) return parts;
    
    const query = searchQuery.toLowerCase();
    return parts
      .map((part) => {
        const filteredChapters = part.chapters.filter((chapter) => {
          const translatedTitle = getChapterTitle(chapter.slug, chapter.title);
          return (
            translatedTitle.toLowerCase().includes(query) ||
            chapter.title.toLowerCase().includes(query) ||
            chapter.slug.toLowerCase().includes(query) ||
            (chapter.description && chapter.description.toLowerCase().includes(query))
          );
        });
        return { ...part, chapters: filteredChapters };
      })
      .filter((part) => part.chapters.length > 0);
  }, [searchQuery]);

  return (
    <nav className="space-y-4 pr-4">
      {filteredParts.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">{t("search.noResults")}</p>
      ) : (
        filteredParts.map((part) => (
          <div key={part.slug}>
            <h4 className="mb-1 text-sm font-medium text-foreground">
              {part.number === 0 ? getPartTitle(part) : `${part.number}. ${getPartTitle(part)}`}
            </h4>
            <div className="space-y-0.5">
              {part.chapters.map((chapter) => {
                const href = `/book/${chapter.slug}`;
                const isActive = pathname === href;
                const isBookmarked = bookmark === chapter.slug;
                const isHovered = hoveredChapter === chapter.slug;
                return (
                  <div
                    key={chapter.slug}
                    className="relative group"
                    onMouseEnter={() => setHoveredChapter(chapter.slug)}
                    onMouseLeave={() => setHoveredChapter(null)}
                  >
                    <Link
                      href={href}
                      onClick={onNavigate}
                      className={cn(
                        "block py-1 px-2 pr-7 text-sm rounded-md transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      {getChapterTitle(chapter.slug, chapter.title)}
                    </Link>
                    {(isHovered || isBookmarked) && onBookmark && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onBookmark(chapter.slug);
                        }}
                        className={cn(
                          "absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-colors",
                          isBookmarked 
                            ? "text-primary" 
                            : "text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                        )}
                        title={isBookmarked ? t("bookmark.remove") : t("bookmark.add")}
                      >
                        <Bookmark className={cn("h-3.5 w-3.5", isBookmarked && "fill-current")} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </nav>
  );
}

export function MobileTOCButton() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { bookmark, saveBookmark } = useBookmark();
  const t = useTranslations("book");

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) setSearchQuery("");
      }}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <List className="h-4 w-4" />
            <span className="sr-only">{t("tableOfContents")}</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-72 px-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Book className="h-4 w-4" />
              {t("title")}
            </SheetTitle>
          </SheetHeader>
          <div className="relative mt-4 mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("search.placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <ScrollArea className="h-[calc(100vh-11rem)]">
            <SidebarContent 
              onNavigate={() => setOpen(false)} 
              searchQuery={searchQuery}
              bookmark={bookmark}
              onBookmark={saveBookmark}
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function BookSidebar() {
  const [searchQuery, setSearchQuery] = useState("");
  const { bookmark, saveBookmark } = useBookmark();
  const t = useTranslations("book");
  const locale = useLocale();
  const pdfLocale = getBookPdfLocale(locale);
  
  return (
    <>
      {/* Desktop: Static sidebar */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-20">
          {/* Donate button */}
          <a
            href="https://donate.stripe.com/aFa8wO4NF2S96jDfn4dMI09"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full mb-3 px-3 py-1.5 text-xs rounded-md border border-pink-200 dark:border-pink-900/50 bg-pink-50/50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-950/40 transition-colors"
          >
            <Heart className="h-3 w-3" />
            {t("donate")}
          </a>

          {/* Download PDF button */}
          <a
            href={`https://raw.githubusercontent.com/f/prompts.chat/refs/heads/main/public/book-pdf/book-${pdfLocale}-print.pdf`}
            download
            className="flex items-center justify-center gap-1.5 w-full mb-3 px-3 py-1.5 text-xs rounded-md border border-muted-foreground/20 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Download className="h-3 w-3" />
            {t("downloadPdf")}
          </a>

          {/* Header with title and search */}
          <div className="flex items-center gap-2 mb-4 pb-4 border-b">
            <Link
              href="/book"
              className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors shrink-0"
            >
              <Book className="h-4 w-4" />
            </Link>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("search.placeholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 pr-7 h-7 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <Globe className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {localeMetadata.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLocale(lang.code)}
                  >
                    {lang.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Navigation */}
          <ScrollArea className="h-[calc(100vh-10rem)]">
            <SidebarContent 
              searchQuery={searchQuery}
              bookmark={bookmark}
              onBookmark={saveBookmark}
            />
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}
