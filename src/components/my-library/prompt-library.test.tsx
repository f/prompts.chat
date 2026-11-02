import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptLibrary } from "./prompt-library";
import { normalizeRows } from "@/lib/my-library";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));
const prompts = normalizeRows([
  { title: "Strategist", prompt: "Plan [TOPIC] for [TARGET MARKET]", category: "Business" },
  { title: "Engineer", prompt: "Build software", category: "Coding" },
]);
beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("prompt library interactions", () => {
  it("previews, customizes, and copies the completed prompt", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<PromptLibrary initialPrompts={prompts} />);
    await user.type(screen.getByLabelText("TOPIC"), "solar");
    await user.type(screen.getByLabelText("TARGET MARKET"), "Manila");
    await user.click(screen.getByRole("button", { name: "copy" }));
    expect(writeText).toHaveBeenCalledWith("Plan solar for Manila");
    expect(screen.getByLabelText("finalPrompt")).toHaveValue("Plan solar for Manila");
    expect(screen.getByText("copied")).toBeInTheDocument();
  });
  it("filters search and categories with clear empty state", async () => {
    const user = userEvent.setup(); render(<PromptLibrary initialPrompts={prompts} />);
    await user.type(screen.getByRole("searchbox"), "software");
    expect(screen.getByLabelText("finalPrompt")).toHaveValue("Build software");
    await user.selectOptions(screen.getByLabelText("category", { exact: true, selector: "select" }), "Business");
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
  it("persists favorites across remounts", async () => {
    const user = userEvent.setup(); const view = render(<PromptLibrary initialPrompts={prompts} />);
    const preview = screen.getByRole("region", { name: "preview" });
    await user.click(within(preview).getByRole("button", { name: "favorites" }));
    expect(JSON.parse(localStorage.getItem("my-library-favorites-v1")!)).toEqual([prompts[0].id]);
    view.unmount(); render(<PromptLibrary initialPrompts={prompts} />);
    expect(within(screen.getByRole("region", { name: "preview" })).getByRole("button", { name: "favorites" })).toHaveAttribute("aria-pressed", "true");
  });
  it("reports clipboard failures without claiming success", async () => {
    const user = userEvent.setup(); vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    render(<PromptLibrary initialPrompts={prompts} />);
    await user.click(screen.getByRole("button", { name: "copy" }));
    expect(screen.getByText("copyError")).toBeInTheDocument();
  });
  it("rejects a malformed import atomically and persists a valid import", async () => {
    render(<PromptLibrary initialPrompts={prompts} />);
    const input = screen.getByLabelText("import", { selector: "input" });
    const bad = new File(['{}'], 'bad.json');
    Object.defineProperty(bad, "text", { value: async () => '{}' });
    fireEvent.change(input, { target: { files: [bad] } });
    await waitFor(() => expect(screen.getByText("importError")).toBeInTheDocument());
    expect(localStorage.getItem("my-library-imports-v1")).toBeNull();
    const good = new File([''], 'good.json');
    Object.defineProperty(good, "text", { value: async () => JSON.stringify([{ title: "Imported", prompt: "Imported content", category: "Custom" }]) });
    fireEvent.change(input, { target: { files: [good] } });
    await waitFor(() => expect(localStorage.getItem("my-library-imports-v1")).toContain('Imported content'));
    expect(screen.getByText("Imported")).toBeInTheDocument();
  });
});
