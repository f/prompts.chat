import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { WebMcpLoader } from "@/components/webmcp/webmcp-loader";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const webmcp = vi.hoisted(() => ({
  startWebMcp: vi.fn(async () => undefined),
  waitForPath: vi.fn(async () => true),
  waitUntil: vi.fn(async () => true),
}));
vi.mock("@/lib/webmcp", () => webmcp);

vi.mock("@/lib/i18n/client", () => ({ setLocale: vi.fn() }));

describe("WebMcpLoader", () => {
  let idleCallbacks: IdleRequestCallback[];

  beforeEach(() => {
    vi.clearAllMocks();
    idleCallbacks = [];
    window.requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    });
    window.cancelIdleCallback = vi.fn();
  });

  it("renders nothing and waits for the browser to be idle", () => {
    const { container } = render(<WebMcpLoader color="#6366f1" locales={["en", "de"]} />);
    expect(container.innerHTML).toBe("");
    expect(window.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 5000 });
    expect(webmcp.startWebMcp).not.toHaveBeenCalled();
  });

  it("starts WebMCP with the site's color, translated labels and locales", async () => {
    render(<WebMcpLoader color="#6366f1" locales={["en", "de"]} />);
    idleCallbacks[0]({ didTimeout: false, timeRemaining: () => 10 });

    await waitFor(() => expect(webmcp.startWebMcp).toHaveBeenCalled());
    const [env, options] = webmcp.startWebMcp.mock.calls[0] as unknown as [
      { locales: string[]; navigate: (path: string) => Promise<void>; refresh: () => void },
      unknown,
    ];
    expect(options).toEqual({
      color: "#6366f1",
      labels: { open: "open", tokenPlaceholder: "tokenPlaceholder", connect: "connect", disconnect: "disconnect", close: "close" },
    });
    expect(env.locales).toEqual(["en", "de"]);

    await env.navigate("/tags/x");
    expect(router.push).toHaveBeenCalledWith("/tags/x");
    expect(webmcp.waitForPath).toHaveBeenCalledWith(expect.any(Function), "/tags/x");
    expect(webmcp.waitUntil).toHaveBeenCalledWith(expect.any(Function), 1000);
    env.refresh();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("cancels the idle callback when unmounted first", () => {
    const { unmount } = render(<WebMcpLoader color="#6366f1" locales={["en"]} />);
    unmount();
    expect(window.cancelIdleCallback).toHaveBeenCalledWith(1);
  });
});
