import { describe, it, expect } from "vitest";
import {
  buildActionPrompt,
  getActionButtonAgents,
  getActionButtonForCategory,
  getActionButtons,
  matchesActionButtonCategory,
  type ActionButtonConfig,
  type ActionButtonPlugin,
} from "@/lib/plugins/action-buttons";
import { buildUrl, getPlatformById } from "@/lib/run-platforms";

const testButton: ActionButtonConfig = {
  id: "test-deploy",
  label: "Deploy",
  icon: "/test.svg",
  categories: ["coding"],
  agents: ["chatgpt", "claude-code"],
  promptPrefix: "PREFIX\n\n",
};

const testPlugins: ActionButtonPlugin[] = [{ id: "test", name: "Test", buttons: [testButton] }];

describe("action buttons config", () => {
  it("registers the Spacefast deploy button for vibe coding and coding", () => {
    const spacefast = getActionButtons().find((button) => button.id === "spacefast-deploy");
    expect(spacefast).toBeDefined();
    expect(spacefast?.categories).toEqual(["vibe", "coding"]);
    expect(spacefast?.label).toBe("Deploy with Spacefast");
    expect(spacefast?.icon).toBe("/sponsors/spacefast.svg");
    expect(spacefast?.promptPrefix).toBe(
      "Deploy this with spacefast.com — build it and publish it using spacefast.com.\n\n"
    );
  });

  it("only references platforms that exist", () => {
    for (const button of getActionButtons()) {
      for (const id of button.agents) {
        expect(getPlatformById(id), `${button.id} -> ${id}`).toBeDefined();
      }
      expect(getActionButtonAgents(button)).toHaveLength(button.agents.length);
    }
  });

  it("offers the requested coding agents", () => {
    const spacefast = getActionButtonForCategory({ slug: "vibe" });
    const names = getActionButtonAgents(spacefast!).map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(["ChatGPT", "Claude", "Claude Code", "Codex", "Cursor", "Gemini"])
    );
  });
});

describe("matchesActionButtonCategory", () => {
  it("matches a listed category slug", () => {
    expect(matchesActionButtonCategory(testButton, { slug: "coding" })).toBe(true);
  });

  it("matches subcategories of a listed category by default", () => {
    expect(matchesActionButtonCategory(testButton, { slug: "web-development", parent: { slug: "coding" } })).toBe(true);
  });

  it("ignores subcategories when includeSubcategories is false", () => {
    const button = { ...testButton, includeSubcategories: false };
    expect(matchesActionButtonCategory(button, { slug: "web-development", parent: { slug: "coding" } })).toBe(false);
  });

  it("does not match other categories or missing categories", () => {
    expect(matchesActionButtonCategory(testButton, { slug: "writing" })).toBe(false);
    expect(matchesActionButtonCategory(testButton, { slug: "blog-writing", parent: { slug: "writing" } })).toBe(false);
    expect(matchesActionButtonCategory(testButton, null)).toBe(false);
    expect(matchesActionButtonCategory(testButton, undefined)).toBe(false);
  });
});

describe("getActionButtonForCategory", () => {
  it("returns the Spacefast button for vibe coding, coding and coding subcategories", () => {
    expect(getActionButtonForCategory({ slug: "vibe" })?.id).toBe("spacefast-deploy");
    expect(getActionButtonForCategory({ slug: "vibe", parent: { slug: "coding" } })?.id).toBe("spacefast-deploy");
    expect(getActionButtonForCategory({ slug: "coding" })?.id).toBe("spacefast-deploy");
    expect(getActionButtonForCategory({ slug: "devops", parent: { slug: "coding" } })?.id).toBe("spacefast-deploy");
  });

  it("returns nothing for other categories so the Run button stays", () => {
    expect(getActionButtonForCategory({ slug: "writing" })).toBeUndefined();
    expect(getActionButtonForCategory({ slug: "image-generation", parent: { slug: "creative" } })).toBeUndefined();
    expect(getActionButtonForCategory(null)).toBeUndefined();
  });

  it("falls back to the Run button under clone branding unless opted out", () => {
    expect(getActionButtonForCategory({ slug: "coding" }, { useCloneBranding: true })).toBeUndefined();
    const plugins = [{ ...testPlugins[0], buttons: [{ ...testButton, hideWithCloneBranding: false }] }];
    expect(getActionButtonForCategory({ slug: "coding" }, { useCloneBranding: true, plugins })?.id).toBe("test-deploy");
  });

  it("uses the provided plugin registry", () => {
    expect(getActionButtonForCategory({ slug: "coding" }, { plugins: testPlugins })?.id).toBe("test-deploy");
    expect(getActionButtonForCategory({ slug: "vibe" }, { plugins: testPlugins })).toBeUndefined();
  });
});

describe("buildActionPrompt", () => {
  it("prepends the configured prefix", () => {
    expect(buildActionPrompt(testButton, "Build a todo app")).toBe("PREFIX\n\nBuild a todo app");
  });

  it("produces prefilled agent URLs with the prefix", () => {
    const text = buildActionPrompt(testButton, "Build a todo app");
    const encoded = encodeURIComponent(text);
    expect(buildUrl("chatgpt", "https://chatgpt.com", text)).toBe(`https://chatgpt.com/?q=${encoded}`);
    expect(buildUrl("claude", "https://claude.ai/new", text)).toBe(`https://claude.ai/new?q=${encoded}`);
    expect(buildUrl("cursor", "cursor://anysphere.cursor-deeplink/prompt", text)).toBe(
      `cursor://anysphere.cursor-deeplink/prompt?text=${encoded}`
    );
  });
});
