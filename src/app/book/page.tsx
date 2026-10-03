import Link from "next/link";
import Image from "next/image";
import { Schoolbell } from "next/font/google";
import { ArrowRight, BookOpen, Sparkles, Brain, Layers, Target, Lightbulb, Gamepad2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Metadata } from "next";
import { PixelRobot } from "@/components/kids/elements/pixel-art";
import { getTranslations, getLocale } from "next-intl/server";
import { ContinueReadingButton } from "@/components/book/continue-reading";
import { getBookPdfLocale } from "@/lib/i18n/locales";

const kidsFont = Schoolbell({
  subsets: ["latin"],
  weight: "400",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("book");
  const title = t("title");
  const description = t("metaDescription");
  
  return {
    title: t("metaTitle"),
    description,
    keywords: [
      "prompt engineering",
      "ChatGPT prompts",
      "AI prompts",
      "prompt engineering guide",
      "prompt engineering book",
      "how to write prompts",
      "AI prompt techniques",
      "chain of thought prompting",
      "few-shot learning",
      "prompt chaining",
      "system prompts",
      "LLM prompts",
      "GPT prompts",
      "Claude prompts",
      "AI communication",
    ],
    authors: [{ name: "Fatih Kadir Akın", url: "https://github.com/f" }],
    creator: "Fatih Kadir Akın",
    publisher: "prompts.chat",
    openGraph: {
      title,
      description,
      url: "https://prompts.chat/book",
      siteName: "prompts.chat",
      images: [
        {
          url: "https://prompts.chat/book-cover-photo.jpg",
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: "en_US",
      type: "book",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["https://prompts.chat/book-cover-photo.jpg"],
      creator: "@fkadev",
    },
    alternates: {
      canonical: "https://prompts.chat/book",
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

// JSON-LD structured data for SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Book",
  name: "The Interactive Book of Prompting",
  alternateName: "AI Prompt Engineering Guide",
  description: "Master AI prompt engineering with this free, interactive guide. Learn ChatGPT prompts, chain-of-thought reasoning, few-shot learning, and advanced techniques.",
  author: {
    "@type": "Person",
    name: "Fatih Kadir Akın",
    url: "https://github.com/f",
  },
  publisher: {
    "@type": "Organization",
    name: "prompts.chat",
    url: "https://prompts.chat",
  },
  url: "https://prompts.chat/book",
  image: "https://prompts.chat/book-cover-photo.jpg",
  inLanguage: "en",
  genre: ["Technology", "Education", "Artificial Intelligence"],
  about: {
    "@type": "Thing",
    name: "Prompt Engineering",
  },
  isAccessibleForFree: true,
  numberOfPages: 28,
  bookFormat: "https://schema.org/EBook",
  license: "https://creativecommons.org/publicdomain/zero/1.0/",
};

export default async function BookHomePage() {
  const t = await getTranslations("book");
  const locale = await getLocale();
  const pdfLocale = getBookPdfLocale(locale);
  
  const highlights = [
    { icon: Brain, text: t("highlights.understanding") },
    { icon: Target, text: t("highlights.crafting") },
    { icon: Layers, text: t("highlights.advanced") },
    { icon: Sparkles, text: t("highlights.interactive") },
    { icon: Lightbulb, text: t("highlights.realWorld") },
    { icon: BookOpen, text: t("highlights.future") },
  ];

  return (
    <>
      {/* JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <div className="max-w-2xl">
      {/* Continue Reading Button */}
      <ContinueReadingButton />

      {/* Book Cover Image */}
      <div className="mb-10">
        <div className="relative aspect-video rounded-lg overflow-hidden shadow-2xl">
          <Image
            src="/book-cover-photo.jpg"
            alt={t("title")}
            fill
            className="object-cover"
            priority
          />
        </div>
      </div>

      {/* Book Cover Header */}
      <div className="mb-10">
        <p className="text-sm text-muted-foreground mb-4">{t("interactiveGuideBy")}</p>
        <h2 className="text-lg font-medium mb-6">Fatih Kadir Akın</h2>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {t("title")}
        </h1>
        <p className="text-xl text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Author Introduction */}
      <div className="mb-10 text-muted-foreground space-y-4">
        <p>
          {t.rich("authorIntro", {
            author: (chunks) => <strong className="text-foreground">{chunks}</strong>,
            repoLink: (chunks) => <a href="https://github.com/f/prompts.chat" className="text-primary hover:underline">{chunks}</a>,
            siteName: (chunks) => <strong className="text-foreground">{chunks}</strong>,
          })}
        </p>
        <p>
          {t("bookDescription")}
        </p>
      </div>

      {/* Highlights */}
      <div className="mb-10">
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("whatYouWillLearn")}</h3>
        <div className="space-y-3">
          {highlights.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <item.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Book Structure */}
      <div className="mb-10 p-6 bg-muted/30 rounded-lg">
        <h3 className="text-sm font-semibold text-foreground mb-3">{t("bookStructure")}</h3>
        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div>• {t("structure.introduction")}</div>
          <div>• {t("structure.part1")}</div>
          <div>• {t("structure.part2")}</div>
          <div>• {t("structure.part3")}</div>
          <div>• {t("structure.part4")}</div>
          <div>• {t("structure.part5")}</div>
          <div>• {t("structure.part6")}</div>
          <div>• {t("structure.chapters")}</div>
        </div>
      </div>

      {/* CTA */}
      <div className="mb-10 flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg">
          <Link href="/book/00a-preface">
            {t("startReading")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/book/01-understanding-ai-models">
            {t("skipToChapter1")}
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={`https://raw.githubusercontent.com/f/prompts.chat/refs/heads/main/public/book-pdf/book-${pdfLocale}-print.pdf`} download>
            <Download className="mr-2 h-4 w-4" />
            {t("downloadPdf")}
          </a>
        </Button>
      </div>

      {/* Note */}
      <div className="text-sm text-muted-foreground italic">
        <p>{t("continuousUpdate")}</p>
      </div>

      {/* Kids Playable Book Section */}
      <div className="mt-10 p-6 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-2 border-amber-200 dark:border-amber-800">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="shrink-0">
            <PixelRobot className="w-16 h-20" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="text-lg text-amber-800 dark:text-amber-200 mb-1">
              {t("kidsSection.question")}
            </p>
            <h3 className={`text-2xl md:text-3xl font-bold text-amber-900 dark:text-amber-100 mb-3 pixel-text-shadow ${kidsFont.className}`}>
              {t("kidsSection.title")}
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">
              {t("kidsSection.description")}
            </p>
            <Button asChild className="bg-green-500 hover:bg-green-600 text-white">
              <a href="/kids">
                <Gamepad2 className="mr-2 h-4 w-4" />
                {t("kidsSection.startPlaying")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-6 border-t text-sm text-muted-foreground">
        <p>
          {t.rich("partOfProject", {
            repoLink: (chunks) => <a href="https://github.com/f/prompts.chat" className="text-primary hover:underline">{chunks}</a>,
          })}
        </p>
      </div>
      </div>
    </>
  );
}
