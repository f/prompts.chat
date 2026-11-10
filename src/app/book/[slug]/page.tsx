import { notFound } from "next/navigation";
import Link from "next/link";
import { getChapterBySlug, getAdjacentChapters, getAllChapters } from "@/lib/book/chapters";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileTOCButton } from "@/components/book/sidebar";
import type { Metadata } from "next";
import { getTranslations, getLocale } from "next-intl/server";
import { JsonLd, breadcrumbSchema } from "@/components/seo/structured-data";
import { absoluteUrl, getBaseUrl, NOINDEX_ROBOTS } from "@/lib/seo";

interface ChapterPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllChapters().map((chapter) => ({
    slug: chapter.slug,
  }));
}

export async function generateMetadata({ params }: ChapterPageProps): Promise<Metadata> {
  const { slug } = await params;
  const chapter = getChapterBySlug(slug);
  const t = await getTranslations("book");

  if (!chapter) {
    return { title: t("chapter.notFound"), robots: NOINDEX_ROBOTS };
  }

  const tSeo = await getTranslations("seo.bookChapter");
  const title = tSeo("title", { chapter: chapter.title });

  const description = chapter.description 
    ? `${chapter.description}. Learn ${chapter.title.toLowerCase()} techniques in this free interactive prompt engineering guide.`
    : `Learn about ${chapter.title.toLowerCase()} in this free interactive prompt engineering guide. Part of The Interactive Book of Prompting.`;

  return {
    title,
    description,
    keywords: [
      chapter.title.toLowerCase(),
      "prompt engineering",
      "AI prompts",
      "ChatGPT",
      chapter.part.toLowerCase(),
      "prompting techniques",
    ],
    authors: [{ name: "Fatih Kadir Akın", url: "https://github.com/f" }],
    openGraph: {
      title,
      description,
      url: `/book/${slug}`,
      siteName: "prompts.chat",
      images: [
        {
          url: absoluteUrl("/book-cover-photo.jpg"),
          width: 1200,
          height: 630,
          alt: `${chapter.title} - Prompt Engineering Guide`,
        },
      ],
      locale: "en_US",
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl("/book-cover-photo.jpg")],
    },
    alternates: {
      canonical: `/book/${slug}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const { slug } = await params;
  const chapter = getChapterBySlug(slug);

  if (!chapter) {
    notFound();
  }

  const { prev, next } = getAdjacentChapters(slug);

  const t = await getTranslations("book");
  const locale = await getLocale();

  // Get translated title and description
  const getChapterTitle = () => {
    try {
      const translated = t(`chapters.${slug}`);
      return translated !== `chapters.${slug}` ? translated : chapter.title;
    } catch {
      return chapter.title;
    }
  };

  const getChapterDescription = () => {
    try {
      const translated = t(`chapterDescriptions.${slug}`);
      return translated !== `chapterDescriptions.${slug}` ? translated : chapter.description;
    } catch {
      return chapter.description;
    }
  };

  const getPartName = () => {
    const partKeys: Record<string, string> = {
      "Introduction": "introduction",
      "Foundations": "foundations",
      "Techniques": "techniques",
      "Advanced": "advanced",
      "Best Practices": "bestPractices",
      "Use Cases": "useCases",
      "Conclusion": "conclusion",
    };
    const key = partKeys[chapter.part];
    if (key) {
      try {
        const translated = t(`parts.${key}`);
        return translated !== `parts.${key}` ? translated : chapter.part;
      } catch {
        return chapter.part;
      }
    }
    return chapter.part;
  };

  const chapterTitle = getChapterTitle();
  const chapterDescription = getChapterDescription();
  const partName = getPartName();
  
  let Content;
  try {
    // Try to load locale-specific content first, fall back to English
    if (locale !== "en") {
      try {
        Content = (await import(`@/content/book/${locale}/${slug}.mdx`)).default;
      } catch {
        // Fall back to English content
        Content = (await import(`@/content/book/${slug}.mdx`)).default;
      }
    } else {
      Content = (await import(`@/content/book/${slug}.mdx`)).default;
    }
  } catch {
    Content = () => (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {t("chapter.comingSoon")}
        </p>
      </div>
    );
  }

  return (
    <article>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            "@id": absoluteUrl(`/book/${slug}`),
            headline: chapter.title,
            description: chapter.description,
            url: absoluteUrl(`/book/${slug}`),
            inLanguage: "en",
            author: { "@type": "Person", name: "Fatih Kadir Akın", url: "https://github.com/f" },
            publisher: { "@type": "Organization", name: "prompts.chat", url: getBaseUrl() },
            image: absoluteUrl("/book-cover-photo.jpg"),
            isAccessibleForFree: true,
            license: "https://creativecommons.org/publicdomain/zero/1.0/",
            isPartOf: {
              "@type": "Book",
              name: "The Interactive Book of Prompting",
              url: absoluteUrl("/book"),
            },
          },
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "The Interactive Book of Prompting", path: "/book" },
            { name: chapter.title, path: `/book/${slug}` },
          ]),
        ]}
      />
      {/* Chapter Header */}
      <header className="mb-8">
        <div className="text-sm text-primary font-medium mb-1">
          {partName}
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight mb-2">{chapterTitle}</h1>
          <MobileTOCButton />
        </div>
        {chapterDescription && (
          <p className="text-muted-foreground">
            {chapterDescription}
          </p>
        )}
      </header>

      {/* Chapter Content */}
      <div className="prose max-w-none">
        <Content />
      </div>

      {/* Navigation */}
      <nav className="flex items-center justify-between mt-12 pt-6 border-t">
        {prev ? (
          <Button variant="ghost" asChild className="gap-2">
            <Link href={`/book/${prev.slug}`}>
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{(() => {
                try {
                  const translated = t(`chapters.${prev.slug}`);
                  return translated !== `chapters.${prev.slug}` ? translated : prev.title;
                } catch {
                  return prev.title;
                }
              })()}</span>
              <span className="sm:hidden">{t("chapter.previous")}</span>
            </Link>
          </Button>
        ) : (
          <div />
        )}
        {next ? (
          <Button variant="ghost" asChild className="gap-2">
            <Link href={`/book/${next.slug}`}>
              <span className="hidden sm:inline">{(() => {
                try {
                  const translated = t(`chapters.${next.slug}`);
                  return translated !== `chapters.${next.slug}` ? translated : next.title;
                } catch {
                  return next.title;
                }
              })()}</span>
              <span className="sm:hidden">{t("chapter.next")}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </nav>
    </article>
  );
}
