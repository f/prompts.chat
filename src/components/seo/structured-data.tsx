import { getConfig } from "@/lib/config";
import { absoluteUrl, getBaseUrl } from "@/lib/seo";

type Schema = Record<string, unknown>;

// Longest prompt text included in JSON-LD; the full prompt is on the page itself
const MAX_SCHEMA_TEXT_LENGTH = 5000;

/**
 * Renders schema.org JSON-LD. `<` is escaped so content can't close the script tag.
 */
export function JsonLd({ data }: { data: Schema | Schema[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>): Schema {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

interface CollectionPageSchemaInput {
  name: string;
  description: string;
  path: string;
  items: Array<{ name: string; path: string }>;
}

/**
 * Listing pages (categories, tags, collections of prompts)
 */
export function collectionPageSchema({ name, description, path, items }: CollectionPageSchemaInput): Schema {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl(path),
    url: absoluteUrl(path),
    name,
    description,
    isPartOf: { "@id": `${baseUrl}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: absoluteUrl(item.path),
      })),
    },
  };
}

interface PromptSchemaInput {
  path: string;
  title: string;
  description: string;
  content: string;
  type: string;
  mediaUrl?: string | null;
  author: { name: string; username: string };
  datePublished: Date;
  dateModified: Date;
  category?: string;
  tags: string[];
  voteCount: number;
  /** Publicly visible comments on the prompt, oldest first. Replies point to their parent. */
  comments: PromptSchemaComment[];
  /** Total number of publicly visible comments; may exceed `comments.length` */
  commentCount: number;
}

export interface PromptSchemaComment {
  id: string;
  parentId: string | null;
  text: string;
  createdAt: Date;
  author: { name: string; username: string };
}

/**
 * Nests replies under their parent comments. Replies whose parent isn't in
 * the list (hidden or beyond the fetched limit) are left out, since they
 * aren't shown on their own on the page either.
 */
function commentTreeSchema(comments: PromptSchemaComment[]): Schema[] {
  const children = new Map<string | null, PromptSchemaComment[]>();
  for (const comment of comments) {
    const siblings = children.get(comment.parentId) ?? [];
    siblings.push(comment);
    children.set(comment.parentId, siblings);
  }

  const toSchema = (comment: PromptSchemaComment): Schema => {
    const replies = children.get(comment.id) ?? [];
    return {
      "@type": "Comment",
      text: comment.text,
      datePublished: comment.createdAt.toISOString(),
      author: {
        "@type": "Person",
        name: comment.author.name,
        url: absoluteUrl(`/@${comment.author.username}`),
      },
      ...(replies.length > 0 && { comment: replies.map(toSchema) }),
    };
  };

  return (children.get(null) ?? []).map(toSchema);
}

/**
 * A prompt is a user-generated post on the platform, so it is described as a
 * SocialMediaPosting with its real author, dates, upvotes and comments.
 * Comments are only ever taken from real data; without any, the comment
 * counter is left out instead of reporting zero.
 */
export function promptSchema(prompt: PromptSchemaInput): Schema {
  const baseUrl = getBaseUrl();
  const url = absoluteUrl(prompt.path);
  const text =
    prompt.content.length > MAX_SCHEMA_TEXT_LENGTH
      ? `${prompt.content.slice(0, MAX_SCHEMA_TEXT_LENGTH)}…`
      : prompt.content;
  const comments = commentTreeSchema(prompt.comments);

  return {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    "@id": url,
    url,
    mainEntityOfPage: url,
    headline: prompt.title,
    description: prompt.description,
    text,
    ...(prompt.type === "IMAGE" && prompt.mediaUrl && { image: prompt.mediaUrl }),
    datePublished: prompt.datePublished.toISOString(),
    dateModified: prompt.dateModified.toISOString(),
    author: {
      "@type": "Person",
      name: prompt.author.name,
      alternateName: `@${prompt.author.username}`,
      url: absoluteUrl(`/@${prompt.author.username}`),
    },
    ...(prompt.category && { articleSection: prompt.category }),
    ...(prompt.tags.length > 0 && { keywords: prompt.tags.join(", ") }),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: prompt.voteCount,
      },
      ...(comments.length > 0
        ? [
            {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/CommentAction",
              userInteractionCount: Math.max(prompt.commentCount, prompt.comments.length),
            },
          ]
        : []),
    ],
    ...(comments.length > 0 && { comment: comments }),
    isPartOf: { "@id": `${baseUrl}/#website` },
    license: "https://creativecommons.org/publicdomain/zero/1.0/",
  };
}

interface PromptHowToSchemaInput {
  id: string;
  name: string;
  description: string;
  content: string;
  author?: string;
  authorUrl?: string;
  datePublished?: string;
  dateModified?: string;
  category?: string;
  tags?: string[];
  voteCount?: number;
  branding: { name: string; logo: string };
}

/**
 * The original HowTo description of a prompt page, kept alongside the
 * SocialMediaPosting schema
 */
export function promptHowToSchema(prompt: PromptHowToSchemaInput): Schema {
  const baseUrl = getBaseUrl();
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${baseUrl}/prompts/${prompt.id}`,
    name: prompt.name,
    description: prompt.description || `AI prompt: ${prompt.name}`,
    step: [
      {
        "@type": "HowToStep",
        name: "Copy the prompt",
        text: prompt.content.substring(0, 500) + (prompt.content.length > 500 ? "..." : ""),
        position: 1,
      },
      {
        "@type": "HowToStep",
        name: "Paste into your AI assistant",
        text: "Open ChatGPT, Claude, Gemini, or your preferred AI assistant and paste the prompt.",
        position: 2,
      },
      {
        "@type": "HowToStep",
        name: "Get your response",
        text: "The AI will respond according to the prompt instructions.",
        position: 3,
      },
    ],
    tool: [
      {
        "@type": "HowToTool",
        name: "AI Assistant (ChatGPT, Claude, Gemini, etc.)",
      },
    ],
    totalTime: "PT2M",
    author: prompt.author
      ? {
          "@type": "Person",
          name: prompt.author,
          url: prompt.authorUrl,
        }
      : undefined,
    datePublished: prompt.datePublished,
    dateModified: prompt.dateModified,
    publisher: {
      "@type": "Organization",
      name: prompt.branding.name,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}${prompt.branding.logo}`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${baseUrl}/prompts/${prompt.id}`,
    },
    aggregateRating: prompt.voteCount && prompt.voteCount > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: 5,
          bestRating: 5,
          ratingCount: prompt.voteCount,
        }
      : undefined,
    keywords: prompt.tags?.join(", ") || prompt.category,
  };
}

interface ProfilePageSchemaInput {
  path: string;
  name: string;
  username: string;
  avatar?: string | null;
  bio?: string | null;
  createdAt: Date;
  promptCount: number;
  /** Public bots; counted as authored works alongside prompts */
  botCount?: number;
}

export function profilePageSchema(profile: ProfilePageSchemaInput): Schema {
  const url = absoluteUrl(profile.path);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": url,
    url,
    dateCreated: profile.createdAt.toISOString(),
    mainEntity: {
      "@type": "Person",
      name: profile.name,
      alternateName: `@${profile.username}`,
      identifier: profile.username,
      ...(profile.avatar && { image: profile.avatar }),
      ...(profile.bio && { description: profile.bio }),
      interactionStatistic: {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/WriteAction",
        userInteractionCount: profile.promptCount + (profile.botCount ?? 0),
      },
    },
  };
}

interface BotSchemaInput {
  path: string;
  name: string;
  description: string;
  platforms: string[];
  author: { name: string; username: string };
  keywords: string[];
  features: string[];
  dateCreated: Date;
  dateModified: Date;
}

/**
 * A bot page describes an installable agent configuration: the WebPage is the
 * listing, its main entity is the SoftwareApplication running on each platform.
 */
export function botSchema(bot: BotSchemaInput): Schema[] {
  const baseUrl = getBaseUrl();
  const url = absoluteUrl(bot.path);
  const keywords = [...new Map(bot.keywords.map((k) => [k.toLowerCase(), k])).values()];
  const author = {
    "@type": "Person",
    name: bot.author.name,
    alternateName: `@${bot.author.username}`,
    url: absoluteUrl(`/@${bot.author.username}`),
  };

  return [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": url,
      url,
      name: bot.name,
      description: bot.description,
      isPartOf: { "@id": `${baseUrl}/#website` },
      mainEntity: { "@id": `${url}#bot` },
      datePublished: bot.dateCreated.toISOString(),
      dateModified: bot.dateModified.toISOString(),
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "@id": `${url}#bot`,
      url,
      mainEntityOfPage: url,
      name: bot.name,
      description: bot.description,
      applicationCategory: "UtilitiesApplication",
      applicationSubCategory: "AI agent",
      operatingSystem: bot.platforms.join(", "),
      ...(bot.features.length > 0 && { featureList: bot.features }),
      ...(keywords.length > 0 && { keywords: keywords.join(", ") }),
      author,
      creator: author,
      dateCreated: bot.dateCreated.toISOString(),
      dateModified: bot.dateModified.toISOString(),
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  ];
}

/**
 * Site-level Organization, WebSite and WebApplication schemas, rendered on the homepage
 */
export async function WebsiteStructuredData() {
  const config = await getConfig();
  const baseUrl = getBaseUrl();
  const useCloneBranding = config.homepage?.useCloneBranding ?? false;

  const organization: Schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${baseUrl}/#organization`,
    name: config.branding.name,
    url: baseUrl,
    logo: {
      "@type": "ImageObject",
      url: `${baseUrl}/favicon/web-app-manifest-512x512.png`,
      width: 512,
      height: 512,
    },
    description: config.branding.description,
    ...(!useCloneBranding && {
      foundingDate: "2022-12-05",
      founder: {
        "@type": "Person",
        name: "Fatih Kadir Akın",
        url: "https://github.com/f",
        sameAs: ["https://github.com/f", "https://x.com/fkadev"],
      },
      sameAs: [
        "https://github.com/f/prompts.chat",
        "https://huggingface.co/datasets/fka/awesome-chatgpt-prompts",
        "https://x.com/promptschat",
      ],
    }),
  };

  const website: Schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${baseUrl}/#website`,
    name: config.branding.name,
    ...(!useCloneBranding && { alternateName: ["prompts chat", "Awesome ChatGPT Prompts"] }),
    url: baseUrl,
    description: config.branding.description,
    inLanguage: "en",
    publisher: { "@id": `${baseUrl}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/prompts?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const softwareApp: Schema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: config.branding.name,
    description: config.branding.description,
    url: baseUrl,
    applicationCategory: "UtilitiesApplication",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    softwareVersion: "1.0",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    featureList: [
      "AI prompt library",
      "Prompt sharing and discovery",
      "Community contributions",
      "Version history",
      "Categories and tags",
    ],
    screenshot: `${baseUrl}/og.png`,
  };

  return <JsonLd data={[organization, website, softwareApp]} />;
}
