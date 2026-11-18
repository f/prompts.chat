import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Analytics, buildGtagInitScript } from "@/components/layout/analytics";
import { applyAnalyticsAuthState } from "@/lib/analytics";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

const sessionState = vi.hoisted(() => ({
  status: "loading" as SessionStatus,
  user: null as null | { id: string; analyticsId?: string },
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: sessionState.status,
    data: sessionState.user ? { user: sessionState.user } : null,
  }),
}));

vi.mock("next/script", () => ({
  default: () => null,
}));

function gtagCalls(dataLayer: unknown[]) {
  return dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>));
}

function runInitScript(script: string, consent: string | null) {
  const fakeWindow = { dataLayer: [] as unknown[] };
  const fakeStorage = { getItem: (key: string) => (key === "cookie-consent" ? consent : null) };
  new Function("window", "dataLayer", "localStorage", script)(fakeWindow, fakeWindow.dataLayer, fakeStorage);
  return gtagCalls(fakeWindow.dataLayer);
}

describe("buildGtagInitScript", () => {
  it("sets logged_in and user_id before config so the first page_view carries them", () => {
    const script = buildGtagInitScript({ gaId: "G-MSNHFWTE77", loggedIn: true, analyticsId: "abc123" });
    const calls = runInitScript(script, "accepted");

    expect(calls.map((c) => c[0])).toEqual(["js", "set", "set", "config"]);
    expect(calls[1]).toEqual(["set", "user_properties", { logged_in: "true" }]);
    expect(calls[2]).toEqual(["set", { user_id: "abc123" }]);
    expect(calls[3]).toEqual(["config", "G-MSNHFWTE77"]);
  });

  it("does not send user_id without analytics cookie consent", () => {
    const script = buildGtagInitScript({ gaId: "G-TEST", loggedIn: true, analyticsId: "abc123" });
    for (const consent of [null, "rejected"]) {
      const calls = runInitScript(script, consent);
      expect(calls).toContainEqual(["set", "user_properties", { logged_in: "true" }]);
      expect(calls.some((c) => (c[1] as { user_id?: unknown })?.user_id !== undefined)).toBe(false);
    }
  });

  it("marks anonymous visitors as logged_in=false and sends no user_id", () => {
    const calls = runInitScript(buildGtagInitScript({ gaId: "G-TEST", loggedIn: false, analyticsId: null }), "accepted");
    expect(calls).toEqual([
      ["js", expect.any(Date)],
      ["set", "user_properties", { logged_in: "false" }],
      ["config", "G-TEST"],
    ]);
  });

  it("omits the user property when the server could not resolve the session", () => {
    const calls = runInitScript(buildGtagInitScript({ gaId: "G-TEST" }), "accepted");
    expect(calls.map((c) => c[0])).toEqual(["js", "config"]);
  });

  it("escapes values so they cannot break out of the script tag", () => {
    const script = buildGtagInitScript({ gaId: "G-</script><script>alert(1)//", loggedIn: false });
    expect(script).not.toContain("</script>");
  });
});

describe("applyAnalyticsAuthState", () => {
  beforeEach(() => {
    delete window.gtag;
    window.dataLayer = [];
  });

  it("queues commands on dataLayer when gtag is not defined yet", () => {
    applyAnalyticsAuthState({ loggedIn: true, userId: "abc" });
    expect(gtagCalls(window.dataLayer!)).toEqual([
      ["set", "user_properties", { logged_in: "true" }],
      ["set", { user_id: "abc" }],
    ]);
  });

  it("clears user_id with null only when one was previously set", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    applyAnalyticsAuthState({ loggedIn: false, userId: null }, { loggedIn: true, userId: "abc" });
    expect(gtag.mock.calls).toEqual([
      ["set", "user_properties", { logged_in: "false" }],
      ["set", { user_id: null }],
    ]);

    gtag.mockClear();
    applyAnalyticsAuthState({ loggedIn: false, userId: null }, null);
    expect(gtag.mock.calls).toEqual([["set", "user_properties", { logged_in: "false" }]]);
  });
});

describe("Analytics session sync", () => {
  let gtag: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtag = vi.fn();
    window.gtag = gtag;
    localStorage.clear();
    sessionState.status = "loading";
    sessionState.user = null;
  });

  it("does nothing while the client session matches the server state", () => {
    sessionState.status = "authenticated";
    sessionState.user = { id: "u1", analyticsId: "abc" };
    localStorage.setItem("cookie-consent", "accepted");

    render(<Analytics gaId="G-TEST" loggedIn analyticsId="abc" />);
    expect(gtag).not.toHaveBeenCalled();
  });

  it("updates GA when the user signs in without a full page load", () => {
    localStorage.setItem("cookie-consent", "accepted");
    sessionState.status = "unauthenticated";
    const { rerender } = render(<Analytics gaId="G-TEST" loggedIn={false} analyticsId={null} />);
    expect(gtag).not.toHaveBeenCalled();

    sessionState.status = "authenticated";
    sessionState.user = { id: "u1", analyticsId: "abc" };
    rerender(<Analytics gaId="G-TEST" loggedIn={false} analyticsId={null} />);

    expect(gtag.mock.calls).toEqual([
      ["set", "user_properties", { logged_in: "true" }],
      ["set", { user_id: "abc" }],
    ]);
  });

  it("clears user_id when the session ends", () => {
    localStorage.setItem("cookie-consent", "accepted");
    sessionState.status = "authenticated";
    sessionState.user = { id: "u1", analyticsId: "abc" };
    const { rerender } = render(<Analytics gaId="G-TEST" loggedIn analyticsId="abc" />);

    sessionState.status = "unauthenticated";
    sessionState.user = null;
    rerender(<Analytics gaId="G-TEST" loggedIn analyticsId="abc" />);

    expect(gtag.mock.calls).toEqual([
      ["set", "user_properties", { logged_in: "false" }],
      ["set", { user_id: null }],
    ]);
  });

  it("sets logged_in but not user_id without consent", () => {
    sessionState.status = "authenticated";
    sessionState.user = { id: "u1", analyticsId: "abc" };

    render(<Analytics gaId="G-TEST" />);
    expect(gtag.mock.calls).toEqual([["set", "user_properties", { logged_in: "true" }]]);
  });
});
