import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canViewPrompt } from "@/lib/prompt-access";
import { getBotUrl, getClassifierUrl, getPromptUrl } from "@/lib/urls";

interface PromptLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

/**
 * Extracts the prompt ID from a URL parameter that may contain a slug
 */
function extractPromptId(idParam: string): string {
  const underscoreIndex = idParam.indexOf("_");
  if (underscoreIndex !== -1) {
    return idParam.substring(0, underscoreIndex);
  }
  return idParam;
}

/**
 * Handles missing prompts and non-canonical prompt URLs before the response
 * starts streaming. The page's loading.tsx boundary sits below this layout,
 * so the 404 and 308 responses issued here keep their HTTP status codes.
 */
export default async function PromptLayout({ children, params }: PromptLayoutProps) {
  const { id: idParam } = await params;
  const id = extractPromptId(idParam);

  const prompt = await db.prompt.findUnique({
    where: { id },
    select: { slug: true, type: true, isPrivate: true, deletedAt: true, authorId: true, classifierSlug: true },
  });

  if (!prompt) {
    notFound();
  }

  // Deleted prompts stay visible to admins, private ones to their authors
  if (prompt.deletedAt || prompt.isPrivate) {
    const session = await auth();
    const canView = prompt.deletedAt ? session?.user?.role === "ADMIN" : canViewPrompt(prompt, session);
    if (!canView) {
      notFound();
    }
  }

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  // Bots have their own pages, including the editor and change requests
  if (prompt.type === "BOT") {
    const botPath = getBotUrl(id, prompt.slug);
    const nested = pathname.match(/^\/prompts\/[^/]+(\/(?:edit|changes(?:\/[^/]+)?))\/?$/)?.[1] ?? "";
    permanentRedirect(`${botPath}${nested}`);
  }
  if (prompt.type === "CLASSIFIER" && prompt.classifierSlug) {
    const nested = pathname.match(/^\/prompts\/[^/]+(\/(?:edit|changes(?:\/[^/]+)?))\/?$/)?.[1] ?? "";
    permanentRedirect(`${getClassifierUrl(prompt.classifierSlug)}${nested}`);
  }

  // Serve every prompt from a single URL: /prompts/{id} and outdated slugs
  // permanently redirect to /prompts/{id}_{current-slug}. Nested routes such
  // as /edit and /changes keep their own URLs.
  const isPromptPage = pathname.split("/").filter(Boolean).length === 2;
  const canonicalPath = getPromptUrl(id, prompt.slug);
  if (isPromptPage && `/prompts/${idParam}` !== canonicalPath) {
    permanentRedirect(`${canonicalPath}${headersList.get("x-search") ?? ""}`);
  }

  return children;
}
