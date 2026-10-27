import { describe, it, expect, vi } from "vitest";
import { promptSchema, type PromptSchemaComment } from "@/components/seo/structured-data";

vi.mock("@/../prompts.config", () => ({
  default: { branding: { name: "prompts.chat" } },
}));

const basePrompt = {
  path: "/prompts/abc_linux-terminal",
  title: "Linux Terminal",
  description: "Act as a Linux terminal",
  content: "I want you to act as a Linux terminal.",
  type: "TEXT",
  author: { name: "Fatih", username: "f" },
  datePublished: new Date("2024-01-01T00:00:00Z"),
  dateModified: new Date("2024-02-01T00:00:00Z"),
  tags: [],
  voteCount: 12,
};

function comment(overrides: Partial<PromptSchemaComment> & { id: string }): PromptSchemaComment {
  return {
    parentId: null,
    text: `Comment ${overrides.id}`,
    createdAt: new Date("2024-03-01T10:00:00Z"),
    author: { name: "Ada", username: "ada" },
    ...overrides,
  };
}

function interactionTypes(schema: Record<string, unknown>) {
  return (schema.interactionStatistic as Array<{ interactionType: string }>).map((s) => s.interactionType);
}

describe("promptSchema", () => {
  it("should leave out comments and the comment counter when there are no comments", () => {
    const schema = promptSchema({ ...basePrompt, comments: [], commentCount: 0 });

    expect(schema).not.toHaveProperty("comment");
    expect(interactionTypes(schema)).toEqual(["https://schema.org/LikeAction"]);
  });

  it("should not report a comment count without comments to back it", () => {
    const schema = promptSchema({ ...basePrompt, comments: [], commentCount: 3 });

    expect(schema).not.toHaveProperty("comment");
    expect(interactionTypes(schema)).not.toContain("https://schema.org/CommentAction");
  });

  it("should describe real comments with their author and date", () => {
    const schema = promptSchema({
      ...basePrompt,
      comments: [comment({ id: "c1", text: "Works great with Claude" })],
      commentCount: 1,
    });

    expect(schema.comment).toEqual([
      {
        "@type": "Comment",
        text: "Works great with Claude",
        datePublished: "2024-03-01T10:00:00.000Z",
        author: { "@type": "Person", name: "Ada", url: "http://localhost:3000/@ada" },
      },
    ]);
    expect(schema.interactionStatistic).toContainEqual({
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/CommentAction",
      userInteractionCount: 1,
    });
  });

  it("should nest replies under their parent comment", () => {
    const schema = promptSchema({
      ...basePrompt,
      comments: [
        comment({ id: "c1" }),
        comment({ id: "c2", parentId: "c1" }),
        comment({ id: "c3" }),
      ],
      commentCount: 3,
    });

    const comments = schema.comment as Array<Record<string, unknown>>;
    expect(comments.map((c) => c.text)).toEqual(["Comment c1", "Comment c3"]);
    expect((comments[0].comment as Array<Record<string, unknown>>).map((c) => c.text)).toEqual(["Comment c2"]);
    expect(comments[1]).not.toHaveProperty("comment");
  });

  it("should leave out replies whose parent isn't public", () => {
    const schema = promptSchema({
      ...basePrompt,
      comments: [comment({ id: "c2", parentId: "hidden" })],
      commentCount: 1,
    });

    expect(schema).not.toHaveProperty("comment");
    expect(interactionTypes(schema)).not.toContain("https://schema.org/CommentAction");
  });

  it("should count all public comments when only some are included", () => {
    const schema = promptSchema({
      ...basePrompt,
      comments: [comment({ id: "c1" })],
      commentCount: 80,
    });

    expect(schema.interactionStatistic).toContainEqual(
      expect.objectContaining({ interactionType: "https://schema.org/CommentAction", userInteractionCount: 80 })
    );
  });
});
