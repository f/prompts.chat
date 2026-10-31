import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BotForm, type BotFormInitialData } from "@/components/bots/bot-form";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const initialData: BotFormInitialData = {
  title: "Desk",
  description: "",
  botPlatforms: ["MUSE"],
  botIcon: null,
  botColor: null,
  computerRequirements: ["LOCAL"],
  installUrl: "",
  content: "Use the browser.",
  isPrivate: false,
  tagIds: [],
  config: { routines: [], skills: [], connectors: [] },
};

function cloudCheckbox() {
  return screen.getByRole("checkbox", { name: /computer\.cloudHint/ });
}

function localCheckbox() {
  return screen.getByRole("checkbox", { name: /computer\.localHint/ });
}

async function submittedComputers() {
  fireEvent.click(screen.getByRole("button", { name: "form.save" }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  const [, init] = vi.mocked(global.fetch).mock.calls.at(-1)!;
  return JSON.parse((init as RequestInit).body as string).computerRequirements;
}

describe("BotForm computer requirements", () => {
  beforeEach(() => {
    // Radix checkboxes measure themselves; jsdom has no ResizeObserver
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "b1", slug: "desk" }) }) as never;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows two independent checkboxes with helper text", () => {
    render(<BotForm mode="edit" botId="b1" initialData={initialData} categories={[]} tags={[]} />);
    expect(cloudCheckbox()).toHaveAttribute("aria-checked", "false");
    expect(localCheckbox()).toHaveAttribute("aria-checked", "true");
    expect(cloudCheckbox()).toHaveAccessibleDescription("computer.cloudHint");
    expect(localCheckbox()).toHaveAccessibleDescription("computer.localHint");
  });

  it("saves both computers, cloud first", async () => {
    render(<BotForm mode="edit" botId="b1" initialData={initialData} categories={[]} tags={[]} />);
    fireEvent.click(cloudCheckbox());
    expect(cloudCheckbox()).toHaveAttribute("aria-checked", "true");
    expect(localCheckbox()).toHaveAttribute("aria-checked", "true");
    expect(await submittedComputers()).toEqual(["CLOUD", "LOCAL"]);
  });

  it("saves an empty list when neither is ticked", async () => {
    render(<BotForm mode="edit" botId="b1" initialData={initialData} categories={[]} tags={[]} />);
    fireEvent.click(localCheckbox());
    expect(await submittedComputers()).toEqual([]);
  });
});
