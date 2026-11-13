/**
 * What the current page is and what it shows, read from the URL and the DOM at call time, since
 * the site navigates client-side and the tools stay registered across pages.
 */

export type PageRoute =
  | { kind: "home" }
  | { kind: "prompt"; id: string }
  | { kind: "bot"; id: string }
  | { kind: "team"; slug: string }
  | { kind: "classifier"; slug: string }
  | { kind: "classifier_chain"; slug: string }
  | { kind: "category"; slug: string }
  | { kind: "tag"; slug: string }
  | { kind: "user"; username: string }
  | { kind: "listing"; section: string; query?: string }
  | { kind: "other"; section: string };

/** Segments under a section that are pages of their own rather than an item */
const RESERVED = new Set(["new", "edit", "changes"]);

const LISTINGS = new Set([
  "prompts",
  "skills",
  "bots",
  "classifiers",
  "categories",
  "tags",
  "workflows",
  "taste",
  "discover",
  "feed",
  "collection",
  "promptmasters",
]);

/** "abc123_some-slug" → "abc123"; slugs never contain underscores, so the first one ends the id */
function idFromSegment(segment: string): string {
  const index = segment.indexOf("_");
  return index === -1 ? segment : segment.slice(0, index);
}

function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function parseRoute(url: URL): PageRoute {
  const segments = url.pathname.split("/").filter(Boolean).map(decode);
  const [first, second, third] = segments;
  const query = url.searchParams.get("q") || undefined;

  if (!first) return { kind: "home" };
  if (first.startsWith("@") && first.length > 1) return { kind: "user", username: first.slice(1) };

  const item = second && !RESERVED.has(second) ? second : undefined;
  switch (first) {
    case "prompts":
      if (item) return { kind: "prompt", id: idFromSegment(item) };
      break;
    case "bots":
      if (second === "teams") {
        if (third && !RESERVED.has(third)) return { kind: "team", slug: third };
        return { kind: "listing", section: "bots/teams", query };
      }
      if (item) return { kind: "bot", id: idFromSegment(item) };
      break;
    case "classifiers":
      if (second === "chains") {
        if (third) return { kind: "classifier_chain", slug: third };
        return { kind: "listing", section: "classifiers/chains", query };
      }
      if (item) return { kind: "classifier", slug: item };
      break;
    case "categories":
      if (item) return { kind: "category", slug: item };
      break;
    case "tags":
      if (item) return { kind: "tag", slug: item };
      break;
  }
  if (LISTINGS.has(first)) return { kind: "listing", section: first, query };
  return { kind: "other", section: first };
}

export interface PageLink {
  text: string;
  path: string;
}

export interface PageSnapshot {
  url: string;
  path: string;
  title: string;
  description: string | null;
  locale: string;
  direction: "ltr" | "rtl";
  route: PageRoute;
  headings: string[];
  links: PageLink[];
  text: string;
  truncated: boolean;
}

const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "SVG", "IFRAME", "CANVAS", "VIDEO", "AUDIO", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]);
const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DETAILS", "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE",
  "FOOTER", "FORM", "HEADER", "HR", "MAIN", "NAV", "OL", "P", "SECTION", "SUMMARY", "TABLE", "TR", "UL",
]);

function isHidden(element: Element): boolean {
  return (
    element.hasAttribute("hidden") ||
    element.getAttribute("aria-hidden") === "true" ||
    element.hasAttribute("data-webmcp-widget")
  );
}

/**
 * The text of a <pre> as the reader would copy it: decorations the page marks unselectable (CodeView's
 * line numbers) are left out, and line elements (CodeView renders a <div> per line) become newlines.
 */
export function preformattedText(pre: Element): string {
  const out: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === 3) {
      out.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    if (element.classList.contains("select-none") || isHidden(element)) return;
    const tag = element.tagName.toUpperCase();
    if (tag === "BR") {
      out.push("\n");
      return;
    }
    if ((tag === "DIV" || tag === "P") && element.previousElementSibling) out.push("\n");
    for (const child of Array.from(element.childNodes)) visit(child);
  };
  for (const child of Array.from(pre.childNodes)) visit(child);
  return out.join("").replace(/^\n+|\n+$/g, "");
}

function walk(node: Node, out: string[], blocks: string[]): void {
  if (node.nodeType === 3) {
    out.push(node.textContent ?? "");
    return;
  }
  if (node.nodeType !== 1) return;
  const element = node as Element;
  const tag = element.tagName.toUpperCase();
  if (SKIPPED_TAGS.has(tag) || isHidden(element)) return;

  const heading = /^H([1-6])$/.exec(tag);
  if (heading) {
    out.push(`\n\n${"#".repeat(Number(heading[1]))} `);
  } else if (tag === "PRE") {
    // Kept out of the prose normalization in extractText, so indentation and blank lines survive
    blocks.push(preformattedText(element));
    out.push(`\n${PRE_PLACEHOLDER}${blocks.length - 1}${PRE_PLACEHOLDER}\n`);
    return;
  } else if (tag === "LI") {
    out.push("\n- ");
  } else if (tag === "BR") {
    out.push("\n");
    return;
  } else if (tag === "TD" || tag === "TH") {
    out.push(" | ");
  } else if (BLOCK_TAGS.has(tag)) {
    out.push("\n");
  }

  for (const child of Array.from(element.childNodes)) walk(child, out, blocks);

  if (heading) out.push("\n\n");
  else if (BLOCK_TAGS.has(tag)) out.push("\n");
}

const PRE_PLACEHOLDER = "\u0000";

/** The readable text of an element as light Markdown: headings, list items and code blocks */
export function extractText(root: Element): string {
  const out: string[] = [];
  const blocks: string[] = [];
  walk(root, out, blocks);
  return out
    .join("")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/^(- |\| )+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(new RegExp(`${PRE_PLACEHOLDER}(\\d+)${PRE_PLACEHOLDER}`, "g"), (_, index: string) => {
      const code = blocks[Number(index)];
      const fence = code.includes("```") ? "````" : "```";
      return `${fence}\n${code}\n${fence}`;
    });
}

const MAX_LINKS = 60;

/** Same-origin links in the main content, deduplicated, so an agent can pick where to go next */
export function extractLinks(root: Element, origin: string): PageLink[] {
  const links: PageLink[] = [];
  const seen = new Set<string>();
  for (const anchor of Array.from(root.querySelectorAll("a[href]"))) {
    if (isHidden(anchor) || anchor.closest("[data-webmcp-widget]")) continue;
    let url: URL;
    try {
      url = new URL(anchor.getAttribute("href") ?? "", origin);
    } catch {
      continue;
    }
    if (url.origin !== origin) continue;
    const path = `${url.pathname}${url.search}`;
    const text = (anchor.textContent ?? "").replace(/\s+/g, " ").trim() || anchor.getAttribute("aria-label") || "";
    if (!text || seen.has(path)) continue;
    seen.add(path);
    links.push({ text: text.slice(0, 120), path });
    if (links.length >= MAX_LINKS) break;
  }
  return links;
}

export function snapshotPage(document: Document, url: URL, maxLength: number): PageSnapshot {
  const main = document.querySelector("main") ?? document.body;
  const fullText = main ? extractText(main) : "";
  const truncated = fullText.length > maxLength;
  return {
    url: url.href,
    path: `${url.pathname}${url.search}`,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
    locale: document.documentElement.lang || "en",
    direction: document.documentElement.dir === "rtl" ? "rtl" : "ltr",
    route: parseRoute(url),
    headings: main
      ? Array.from(main.querySelectorAll("h1, h2, h3"))
          .map((h) => (h.textContent ?? "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 40)
      : [],
    links: main ? extractLinks(main, url.origin) : [],
    text: truncated ? `${fullText.slice(0, maxLength)}…` : fullText,
    truncated,
  };
}

/** The snapshot as one Markdown document, for the page resource */
export function snapshotMarkdown(snapshot: PageSnapshot): string {
  const lines = [`# ${snapshot.title}`, "", `URL: ${snapshot.url}`, `Locale: ${snapshot.locale}`];
  if (snapshot.description) lines.push(`Description: ${snapshot.description}`);
  lines.push("", snapshot.text);
  return lines.join("\n") + "\n";
}

/**
 * A same-origin path to navigate to, from a path or an absolute URL on this site; null for
 * anything else (other origins, protocol-relative URLs, javascript: and the like).
 */
export function toSameOriginPath(target: string, origin: string): string | null {
  const value = target.trim();
  if (!value || value.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(value.startsWith("/") ? value : value.includes("://") ? value : `/${value}`, origin);
  } catch {
    return null;
  }
  // A pathname such as "//example.org/" would be read as a protocol-relative URL by the router
  if (url.origin !== origin || url.pathname.startsWith("//")) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
