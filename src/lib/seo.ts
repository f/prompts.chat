import type { Metadata } from "next";
import config from "@/../prompts.config";

export const SITE_NAME = config.branding.name;

const DEFAULT_OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: `${SITE_NAME} - AI Prompts Community`,
};

/**
 * Robots directives for pages that should stay out of search results
 * while still letting crawlers follow their links.
 */
export const NOINDEX_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: true,
  googleBot: {
    index: false,
    follow: true,
  },
};

/**
 * Returns the absolute site origin without a trailing slash
 */
export function getBaseUrl(): string {
  return (process.env.NEXTAUTH_URL || "https://prompts.chat").replace(/\/+$/, "");
}

/**
 * Builds an absolute URL for a site path. Absolute URLs are returned as-is.
 */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Returns the canonical path of a paginated listing.
 * The first page never carries a `page` parameter.
 */
export function paginatedPath(path: string, page: number): string {
  return page > 1 ? `${path}?page=${page}` : path;
}

/**
 * Turns free text (markdown, prompt variables, line breaks) into a plain
 * meta description of at most `maxLength` characters, cut on a word boundary.
 */
export function toMetaDescription(text: string, maxLength = 160): string {
  // Prompt content has no length limit, and the markup patterns below get slow
  // on long unterminated "[" or "${" runs, so only the start of the text is used
  const plain = text
    .slice(0, 2000)
    // ${variable} and ${variable:default} -> variable
    .replace(/\$\{([^}:]+)(?::[^}]*)?\}/g, "$1")
    // Markdown images and links
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Markdown syntax characters
    .replace(/[`*#>|~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLength) return plain;

  const cut = plain.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/**
 * Escapes a value for use in XML. Next.js writes sitemap values into the XML
 * as-is, so a URL with a query string such as "?format=jpg&name=large" would
 * otherwise make the whole sitemap invalid.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Turns a stored media URL into an absolute, XML-safe URL for an image
 * sitemap entry, or null when it isn't a usable http(s) URL
 */
export function toSitemapImageUrl(mediaUrl: string): string | null {
  try {
    const url = new URL(mediaUrl, getBaseUrl());
    return url.protocol === "http:" || url.protocol === "https:" ? escapeXml(url.href) : null;
  } catch {
    return null;
  }
}

interface PageMetadataOptions {
  /** Page title. The "| prompts.chat" suffix is added by the root title template. */
  title: string;
  description: string;
  /** Path of the page relative to the site root, e.g. "/categories/coding" */
  path: string;
  /**
   * Preferred URL when it differs from `path`, e.g. the unfiltered listing a
   * filter view belongs to. Defaults to `path`.
   */
  canonical?: string;
  /** Use the title as-is instead of applying the root title template */
  absoluteTitle?: boolean;
  /**
   * Keep the page out of search results. The canonical link is still emitted
   * so filter and alternate URLs consolidate onto the preferred URL. Dead
   * ends (auth, not-found) should use NOINDEX_ROBOTS without this helper.
   */
  noindex?: boolean;
  openGraphType?: "website" | "article" | "profile";
  /**
   * Social preview image URL, or "route" when the route has its own
   * opengraph-image file that must not be overridden
   */
  image?: string;
}

/**
 * Builds consistent page metadata: title, description, self-referencing
 * canonical URL, Open Graph and Twitter cards.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  canonical = path,
  absoluteTitle = false,
  noindex = false,
  openGraphType = "website",
  image,
}: PageMetadataOptions): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const images = image === "route" ? undefined : image ? [{ url: image }] : [DEFAULT_OG_IMAGE];

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    openGraph: {
      type: openGraphType,
      siteName: SITE_NAME,
      locale: "en_US",
      url: canonical,
      title: socialTitle,
      description,
      ...(images && { images }),
    },
    twitter: {
      card: "summary_large_image",
      site: "@promptschat",
      title: socialTitle,
      description,
      ...(images && { images: images.map((img) => img.url) }),
    },
    ...(noindex && { robots: NOINDEX_ROBOTS }),
  };
}
