import { describe, it, expect, beforeEach } from "vitest";
import { extractLinks, extractText, parseRoute, snapshotMarkdown, snapshotPage, toSameOriginPath } from "@/lib/webmcp/page";

const ORIGIN = "https://prompts.chat";
const route = (path: string) => parseRoute(new URL(path, ORIGIN));

describe("parseRoute", () => {
  it.each([
    ["/", { kind: "home" }],
    ["/prompts/cmabc123_write-a-poem", { kind: "prompt", id: "cmabc123" }],
    ["/prompts/cmabc123", { kind: "prompt", id: "cmabc123" }],
    ["/prompts/cmabc123_write-a-poem/edit", { kind: "prompt", id: "cmabc123" }],
    ["/prompts/new", { kind: "listing", section: "prompts", query: undefined }],
    ["/prompts?q=python", { kind: "listing", section: "prompts", query: "python" }],
    ["/bots/bot1_helper", { kind: "bot", id: "bot1" }],
    ["/bots/new", { kind: "listing", section: "bots", query: undefined }],
    ["/bots/teams", { kind: "listing", section: "bots/teams", query: undefined }],
    ["/bots/teams/research-crew", { kind: "team", slug: "research-crew" }],
    ["/bots/teams/new", { kind: "listing", section: "bots/teams", query: undefined }],
    ["/classifiers/ticket-router", { kind: "classifier", slug: "ticket-router" }],
    ["/classifiers/chains/support-flow", { kind: "classifier_chain", slug: "support-flow" }],
    ["/classifiers/new", { kind: "listing", section: "classifiers", query: undefined }],
    ["/categories/coding", { kind: "category", slug: "coding" }],
    ["/tags/python", { kind: "tag", slug: "python" }],
    ["/@alice", { kind: "user", username: "alice" }],
    ["/skills?q=pdf", { kind: "listing", section: "skills", query: "pdf" }],
    ["/book/chapter-1", { kind: "other", section: "book" }],
    ["/tags/c%2B%2B", { kind: "tag", slug: "c++" }],
  ])("%s", (path, expected) => {
    expect(route(path)).toEqual(expected);
  });
});

describe("toSameOriginPath", () => {
  it.each([
    ["/prompts?q=x", "/prompts?q=x"],
    ["prompts", "/prompts"],
    ["https://prompts.chat/bots/teams#top", "/bots/teams#top"],
    ["  /tags/python  ", "/tags/python"],
  ])("accepts %s", (input, expected) => {
    expect(toSameOriginPath(input, ORIGIN)).toBe(expected);
  });

  it.each([
    "https://evil.example/",
    "//evil.example/x",
    "",
    "   ",
    "http://prompts.chat/",
    "https://prompts.chat//evil.example/",
    "https://prompts.chat///evil.example/x",
    "/.//evil.example/",
  ])("refuses %s", (input) => {
    expect(toSameOriginPath(input, ORIGIN)).toBeNull();
  });

  it("keeps javascript: and similar inputs inside the site", () => {
    expect(toSameOriginPath("javascript:alert(1)", ORIGIN)).toBe("/javascript:alert(1)");
  });
});

describe("page extraction", () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="description" content="A poem prompt">';
    document.title = "Write a poem | prompts.chat";
    document.documentElement.lang = "de";
    document.documentElement.dir = "ltr";
    document.body.innerHTML = `
      <header><a href="/settings">Settings</a></header>
      <main>
        <h1>Write a   poem</h1>
        <p>Act as a <strong>poet</strong>.</p>
        <ul><li>First</li><li>Second</li></ul>
        <pre>Write about \${topic}</pre>
        <script>window.secret = 1</script>
        <button>Copy</button>
        <div aria-hidden="true">decoration</div>
        <a href="/tags/poetry">Poetry</a>
        <a href="/tags/poetry">Poetry again</a>
        <a href="https://example.com/">External</a>
        <a href="/@alice"><span aria-hidden="true"></span></a>
      </main>
      <div data-webmcp-widget="true"><a href="/x">Widget link</a></div>`;
  });

  it("turns the main content into light Markdown", () => {
    const text = extractText(document.querySelector("main")!);
    expect(text).toContain("# Write a poem");
    expect(text).toContain("Act as a poet.");
    expect(text).toContain("- First\n- Second");
    expect(text).toContain("```\nWrite about ${topic}\n```");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("Copy");
    expect(text).not.toContain("decoration");
    expect(text).not.toMatch(/\n{3,}/);
  });

  it("keeps preformatted text verbatim", () => {
    const main = document.createElement("main");
    main.innerHTML = "<p>Run   this:</p><pre>def f():\n    return  1\n\n\nprint(f())</pre>";
    expect(extractText(main)).toBe("Run this:\n\n```\ndef f():\n    return  1\n\n\nprint(f())\n```");
  });

  it("reads CodeView's numbered lines as source lines", () => {
    // Markup as rendered by src/components/ui/code-view.tsx
    const main = document.createElement("main");
    const lines = ["name: x", "steps:", "", "  - run: echo ```"]
      .map((line, i) => `<div class="flex"><span class="select-none">${i + 1}</span><span class="flex-1"><span>${line}</span></span></div>`)
      .join("");
    main.innerHTML = `<pre><div class="language-yaml block">${lines}</div></pre>`;
    expect(extractText(main)).toBe("````\nname: x\nsteps:\n\n  - run: echo ```\n````");
  });

  it("collects same-origin links once each", () => {
    expect(extractLinks(document.querySelector("main")!, ORIGIN)).toEqual([{ text: "Poetry", path: "/tags/poetry" }]);
  });

  it("snapshots the page with its route, locale and headings", () => {
    const snapshot = snapshotPage(document, new URL("/prompts/abc_write-a-poem", ORIGIN), 8000);
    expect(snapshot).toMatchObject({
      url: "https://prompts.chat/prompts/abc_write-a-poem",
      path: "/prompts/abc_write-a-poem",
      title: "Write a poem | prompts.chat",
      description: "A poem prompt",
      locale: "de",
      direction: "ltr",
      route: { kind: "prompt", id: "abc" },
      headings: ["Write a poem"],
      truncated: false,
    });
    expect(snapshot.text).not.toContain("Settings");
    expect(snapshot.text).not.toContain("Widget link");
  });

  it("truncates long text", () => {
    const snapshot = snapshotPage(document, new URL("/", ORIGIN), 10);
    expect(snapshot.truncated).toBe(true);
    expect(snapshot.text).toHaveLength(11);
  });

  it("reports right-to-left pages", () => {
    document.documentElement.dir = "rtl";
    expect(snapshotPage(document, new URL("/", ORIGIN), 100).direction).toBe("rtl");
  });

  it("renders a snapshot as a Markdown document", () => {
    const markdown = snapshotMarkdown(snapshotPage(document, new URL("/", ORIGIN), 8000));
    expect(markdown.startsWith("# Write a poem | prompts.chat\n\nURL: https://prompts.chat/\nLocale: de\nDescription: A poem prompt\n")).toBe(true);
  });
});
