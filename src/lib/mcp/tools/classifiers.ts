import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { filterClassifiers, formatClassifierDefinition, getChainsForClassifier } from "@/lib/classifiers";
import { CLASSIFIER_CATEGORIES } from "@/lib/classifiers/categories";
import { findClassifierBySlug, getClassifierCatalog, listedClassifiers } from "@/lib/classifiers/store";
import type { ClassifierCategoryId, ClassifierRecord } from "@/lib/classifiers/types";
import { getClassifierUrl } from "@/lib/urls";
import type { McpContext } from "../context";
import { cursorInput, decodeCursor, limitInput, nextCursor } from "../schemas";
import { defineTool, toolResult, ToolError } from "../tool";

const CATEGORIES = CLASSIFIER_CATEGORIES as [ClassifierCategoryId, ...ClassifierCategoryId[]];

const classifierSummaryOutput = z.looseObject({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  summary: z.string(),
  questionType: z.string(),
  outcomes: z.array(z.string()),
  tags: z.array(z.string()),
  link: z.string(),
});

function summaryJson(classifier: ClassifierRecord, baseUrl: string) {
  return {
    id: classifier.id,
    slug: classifier.slug,
    name: classifier.name,
    category: classifier.category,
    summary: classifier.summary,
    questionType: classifier.question.type,
    outcomes: classifier.outcomes.map((outcome) => outcome.label),
    tags: classifier.tags,
    link: `${baseUrl}${getClassifierUrl(classifier.slug)}`,
  };
}

export function registerClassifierTools(server: McpServer, ctx: McpContext) {
  defineTool(
    server,
    ctx,
    {
      name: "search_classifiers",
      title: "Search Classifiers",
      description:
        "Search the classifier catalog on prompts.chat (/classifiers): small LLM classifiers that answer one question about an input (e.g. route a support ticket, flag a refund risk) and map the answer to outcomes. " +
        "Every word of `query` must match the name, summary, problem, question, tags or outcomes. Call get_classifier for the full definition.",
      kind: "read",
      inputSchema: {
        query: z.string().optional().describe("Keywords; every word must match"),
        category: z.enum(CATEGORIES).optional().describe("Classifier category"),
        limit: limitInput(10, 50, "classifiers"),
        cursor: cursorInput,
      },
      outputSchema: {
        total: z.number(),
        count: z.number(),
        classifiers: z.array(classifierSummaryOutput),
        nextCursor: z.string().optional(),
      },
      failureMessage: "Failed to search classifiers",
    },
    async ({ query, category, limit, cursor }) => {
      const offset = decodeCursor(cursor);
      const catalog = await getClassifierCatalog();
      const matches = filterClassifiers(listedClassifiers(catalog), { query: query ?? "", category: category ?? null });
      const page = matches.slice(offset, offset + limit);
      return toolResult({
        total: matches.length,
        count: page.length,
        classifiers: page.map((classifier) => summaryJson(classifier, ctx.baseUrl)),
        nextCursor: nextCursor(offset, page.length, limit, matches.length),
      });
    }
  );

  defineTool(
    server,
    ctx,
    {
      name: "get_classifier",
      title: "Get Classifier",
      description:
        "Get a classifier by slug, as in /classifiers/{slug}: its question and answer options, the outcomes each answer leads to, the input it expects, guidance, caveats and example scenarios. " +
        "`definition` is the whole classifier as plain text, ready to paste into a prompt; `chains` lists the classifier chains that use it.",
      kind: "read",
      inputSchema: {
        slug: z.string().trim().min(1).describe("Classifier slug"),
      },
      outputSchema: {
        ...classifierSummaryOutput.shape,
        problem: z.string(),
        goal: z.string(),
        definition: z.string(),
        chains: z.array(z.looseObject({ slug: z.string(), name: z.string() })),
      },
      failureMessage: "Failed to get classifier",
    },
    async ({ slug }) => {
      const found = await findClassifierBySlug(slug);
      const canView =
        !!found && (!found.row.isPrivate || found.row.authorId === ctx.user?.id || ctx.user?.role === "ADMIN");
      if (!found || !canView) throw new ToolError("not_found", "Classifier not found");
      const { record } = found;
      const chains = record.isPrivate ? [] : getChainsForClassifier((await getClassifierCatalog()).chains, record.slug);
      return toolResult({
        ...summaryJson(record, ctx.baseUrl),
        problem: record.problem,
        goal: record.goal,
        question: record.question,
        input: record.input,
        guidance: record.guidance,
        caveats: record.caveats ?? [],
        scenarios: record.scenarios,
        definition: formatClassifierDefinition(record),
        chains: chains.map((chain) => ({ slug: chain.slug, name: chain.name })),
      });
    }
  );
}
