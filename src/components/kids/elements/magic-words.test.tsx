import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MagicWords } from "./magic-words";
import { markSectionCompleted } from "@/lib/kids/progress";

const { markSectionComplete } = vi.hoisted(() => ({
  markSectionComplete: vi.fn(),
}));


vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: "Magic Words",
      check: "Check",
      correct: "correct",
      retry: "Retry",
      tryAgain: "Try again",
      dragOrTap: "Drag or tap",
    };

    return translations[key] ?? key;
  },
}));


vi.mock("@/components/kids/providers/level-context", () => ({
  useLevelSlug: () => "test-level",
  useSectionNavigation: () => ({
    currentSection: 1,
    markSectionComplete,
    registerSectionRequirement: vi.fn(),
  }),
}));

vi.mock("@/lib/kids/progress", () => ({
  getComponentState: vi.fn(() => null),
  saveComponentState: vi.fn(),
  markSectionCompleted: vi.fn(),
}));

const testProps = {
  sentence: "A ___ lives in a ___",
  blanks: [
    { hint: "Animal", answers: ["cat"] },
    { hint: "Place", answers: ["castle"] },
  ],
  successMessage: "Well done!",
};

describe("MagicWords completion validation", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("does not complete the section with incorrect answers", async () => {
    const user = userEvent.setup();

    render(<MagicWords {...testProps} />);

    // Intentionally put the place in the animal blank.
    await user.click(await screen.findByRole("button", { name: /castle/i }));

    // Put the animal in the place blank.
    await user.click(screen.getByRole("button", { name: /cat/i }));

    await user.click(screen.getByRole("button", { name: /^check$/i }));

    expect(screen.getByText(/0\s*\/\s*2\s*correct/i)).toBeInTheDocument();

    expect(markSectionCompleted).not.toHaveBeenCalled();
    expect(markSectionComplete).not.toHaveBeenCalled();
  });

  it("completes the section when all answers are correct", async () => {
    const user = userEvent.setup();

    render(<MagicWords {...testProps} />);

    await user.click(await screen.findByRole("button", { name: /^cat$/i }));
    await user.click(screen.getByRole("button", { name: /^castle$/i }));
    await user.click(screen.getByRole("button", { name: /^check$/i }));

    await waitFor(() => {
      expect(markSectionCompleted).toHaveBeenCalledWith("test-level", 1);
      expect(markSectionComplete).toHaveBeenCalledWith(1);
    });

    expect(screen.getByText(/Well done!/i)).toBeInTheDocument();
  });

  it("prevents submission when blanks are incomplete", async () => {
    const user = userEvent.setup();

    render(<MagicWords {...testProps} />);

    const checkButton = await screen.findByRole("button", {
      name: /^check$/i,
    });

    expect(checkButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^cat$/i }));

    expect(checkButton).toBeDisabled();
    expect(markSectionCompleted).not.toHaveBeenCalled();
    expect(markSectionComplete).not.toHaveBeenCalled();
  });
});
