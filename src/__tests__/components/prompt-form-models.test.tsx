import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PromptForm } from "@/components/prompts/prompt-form";

vi.mock("@/components/prompts/prompt-builder", () => ({ PromptBuilder: () => null }));
vi.mock("@/components/prompts/media-generator", () => ({ MediaGenerator: () => null }));
vi.mock("@/components/prompts/skill-editor", () => ({ SkillEditor: () => null }));
vi.mock("@/components/prompts/contributor-search", () => ({ ContributorSearch: () => null }));
vi.mock("@/components/ui/code-editor", () => ({ CodeEditor: () => null }));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) => ({
    ok: true,
    json: async () => init?.method ? { id: "saved", slug: "saved-prompt" } : {
      mode: "url", imageModels: [], videoModels: [], audioModels: [],
    },
  }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  });
  // Radix Select uses these browser APIs when opening its popup.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const initialData = { title: "Model compatibility", content: "A test prompt", type: "TEXT" as const };

async function submitAndRead(method: string, url: string) {
  fireEvent.click(screen.getByRole("button", { name: method === "POST" ? "createButton Prompt" : "update Prompt" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method })));
  const [, init] = fetchMock.mock.calls.find(([path, options]) => path === url && options?.method === method)!;
  expect(init.headers).toEqual({ "Content-Type": "application/json" });
  return JSON.parse(init.body);
}

describe("prompt model selection requests", () => {
  it("offers Flash before M3 and serializes the selected Flash slug", async () => {
    render(<PromptForm categories={[]} tags={[]} initialData={initialData} />);
    fireEvent.click(screen.getByRole("button", { name: "advancedOptions" }));
    const trigger = screen.getByText("selectModel").closest("button")!;
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const options = await screen.findAllByRole("option");
    expect(options.filter(option => option.textContent?.startsWith("MiniMax")).map(option => option.textContent)).toEqual([
      "MiniMax-M3.1-Flash", "MiniMax-M3",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "MiniMax-M3.1-Flash" }));
    expect((await submitAndRead("POST", "/api/prompts")).bestWithModels).toEqual(["minimax-m3-1-flash"]);
  });

  it("keeps a new prompt's empty selection", async () => {
    render(<PromptForm categories={[]} tags={[]} initialData={initialData} />);
    expect((await submitAndRead("POST", "/api/prompts")).bestWithModels).toEqual([]);
  });

  it.each(["minimax-m3", "minimax-m2-7", "custom-model"])("preserves saved %s in the PATCH payload", async slug => {
    render(<PromptForm categories={[]} tags={[]} mode="edit" promptId="saved" initialData={{ ...initialData, bestWithModels: [slug] }} />);
    expect((await submitAndRead("PATCH", "/api/prompts/saved")).bestWithModels).toEqual([slug]);
  });

  it("preserves media metadata while saving model compatibility", async () => {
    render(<PromptForm categories={[]} tags={[]} mode="edit" promptId="saved" initialData={{
      ...initialData, type: "IMAGE", mediaUrl: "https://example.com/image.png",
      requiresMediaUpload: true, requiredMediaType: "IMAGE", requiredMediaCount: 2,
      bestWithModels: ["minimax-m2-7"],
    }} />);
    expect(await submitAndRead("PATCH", "/api/prompts/saved")).toMatchObject({
      type: "IMAGE", mediaUrl: "https://example.com/image.png", requiresMediaUpload: true,
      requiredMediaType: "IMAGE", requiredMediaCount: 2, bestWithModels: ["minimax-m2-7"],
    });
  });
});
