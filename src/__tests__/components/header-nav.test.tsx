import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { Header } from "@/components/layout/header";

const navState = vi.hoisted(() => ({
  pathname: "/",
  user: null as null | { name: string; username: string; role: string },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => navState.pathname,
}));

vi.mock("next/font/google", () => ({
  Schoolbell: () => ({ className: "kids-font" }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: navState.user ? { user: navState.user } : null }),
  signOut: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@/components/providers/branding-provider", () => ({
  useBranding: () => ({ name: "prompts.chat", logo: null, useCloneBranding: false }),
}));

vi.mock("@/components/layout/notification-bell", () => ({
  NotificationBell: () => null,
}));

vi.mock("@/lib/i18n/client", () => ({ setLocale: vi.fn() }));

function desktopNav() {
  const nav = screen
    .getAllByRole("navigation", { hidden: true })
    .find((el) => el.className.includes("md:flex"));
  if (!nav) throw new Error("desktop nav not found");
  return nav;
}

function openMoreMenu() {
  const trigger = within(desktopNav()).getByRole("button", { name: "nav.more" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.getByRole("menu");
}

describe("Header desktop nav", () => {
  beforeEach(() => {
    navState.pathname = "/";
    navState.user = { name: "Jane", username: "jane", role: "USER" };
  });

  it("shows only the primary items, in order, followed by the More button", () => {
    render(<Header />);
    const nav = desktopNav();

    const labels = within(nav).getAllByRole("link").map((link) => link.textContent);
    expect(labels).toEqual([
      "nav.collection",
      "nav.teams",
      "nav.bots",
      "nav.skills",
      "nav.prompts",
      "nav.promptmasters",
    ]);
    expect(nav.lastElementChild).toBe(within(nav).getByRole("button", { name: "nav.more" }));
    for (const link of within(nav).getAllByRole("link")) {
      expect(link.className).toContain("whitespace-nowrap");
    }
  });

  it("hides My Collection for signed-out users", () => {
    navState.user = null;
    render(<Header />);
    expect(within(desktopNav()).queryByText("nav.collection")).not.toBeInTheDocument();
  });

  it("lists the overflow items in the More menu", () => {
    render(<Header />);
    const menu = openMoreMenu();
    const hrefs = within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.getAttribute("href"));
    expect(hrefs.slice(0, 5)).toEqual(["/feed", "/workflows", "/categories", "/tags", "/taste"]);
  });

  it("omits Feed from the More menu for signed-out users", () => {
    navState.user = null;
    render(<Header />);
    const menu = openMoreMenu();
    expect(within(menu).queryByText("nav.feed")).not.toBeInTheDocument();
    expect(within(menu).getByText("nav.workflows")).toBeInTheDocument();
  });

  it("marks the More button active when the route matches one of its items", () => {
    navState.pathname = "/tags/coding";
    render(<Header />);
    const trigger = within(desktopNav()).getByRole("button", { name: "nav.more" });
    expect(trigger.className).toContain("bg-accent");
    expect(trigger.className).toContain("text-foreground");
  });

  it("leaves the More button inactive on primary routes", () => {
    navState.pathname = "/prompts";
    render(<Header />);
    const trigger = within(desktopNav()).getByRole("button", { name: "nav.more" });
    expect(trigger.className).toContain("text-muted-foreground");
    expect(trigger.className).not.toMatch(/(^|\s)bg-accent(\s|$)/);
  });
});
