// @vitest-environment node

import { Auth, type AuthConfig } from "@auth/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { githubPlugin } from "@/lib/plugins/auth/github";

const ORIGIN = "https://prompts.test";
const GITHUB_ISSUER = "https://github.com/login/oauth";

function responseCookies(response: Response): string {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
}

describe("GitHub OAuth callback", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const signIn = vi.fn(() => true);
  const logError = vi.fn();
  let config: AuthConfig;

  beforeEach(() => {
    vi.stubEnv("GITHUB_CLIENT_ID", "test-github-client");
    vi.stubEnv("GITHUB_CLIENT_SECRET", "test-github-secret");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://github.com/login/oauth/access_token") {
        return Response.json({ access_token: "test-access-token", token_type: "bearer" });
      }
      if (url === "https://api.github.com/user") {
        return Response.json({
          id: 123,
          login: "testuser",
          name: "Test User",
          email: "test@example.com",
          avatar_url: "https://avatars.githubusercontent.com/u/123",
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    config = {
      providers: [githubPlugin.getProvider()],
      secret: "github-callback-test-secret",
      trustHost: true,
      basePath: "/api/auth",
      callbacks: { signIn },
      logger: { error: logError, warn: vi.fn(), debug: vi.fn() },
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function startSignIn(): Promise<string> {
    const csrfResponse = await Auth(new Request(`${ORIGIN}/api/auth/csrf`), config);
    const { csrfToken } = await csrfResponse.json() as { csrfToken: string };
    const response = await Auth(new Request(`${ORIGIN}/api/auth/signin/github`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: responseCookies(csrfResponse),
      },
      body: new URLSearchParams({ csrfToken, callbackUrl: ORIGIN }),
    }), config);

    const authorizationUrl = new URL(response.headers.get("location")!);
    expect(authorizationUrl.origin).toBe("https://github.com");
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizationUrl.searchParams.get("code_challenge")).toBeTruthy();
    return responseCookies(response);
  }

  it.each([GITHUB_ISSUER, undefined])("accepts GitHub callbacks with issuer %s", async (issuer) => {
    const cookies = await startSignIn();
    const callbackUrl = new URL(`${ORIGIN}/api/auth/callback/github?code=test-code`);
    if (issuer) callbackUrl.searchParams.set("iss", issuer);

    const response = await Auth(new Request(callbackUrl, { headers: { Cookie: cookies } }), config);

    expect(logError).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(ORIGIN);
    expect(signIn).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ email: "test@example.com", username: "testuser" }),
      account: expect.objectContaining({ provider: "github", providerAccountId: "123" }),
    }));
    expect(responseCookies(response)).toContain("__Secure-authjs.session-token=");
    const tokenRequest = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/access_token"));
    expect((tokenRequest?.[1]?.body as URLSearchParams).get("code_verifier")).toBeTruthy();
  });

  it("rejects a callback from an unexpected issuer before exchanging the code", async () => {
    const cookies = await startSignIn();
    const callbackUrl = new URL(`${ORIGIN}/api/auth/callback/github?code=test-code`);
    callbackUrl.searchParams.set("iss", "https://unexpected.example.com");

    const response = await Auth(new Request(callbackUrl, { headers: { Cookie: cookies } }), config);

    expect(new URL(response.headers.get("location")!).searchParams.get("error")).toBe("Configuration");
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({
      cause: expect.objectContaining({
        err: expect.objectContaining({ message: 'unexpected "iss" (issuer) response parameter value' }),
      }),
    }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
    expect(responseCookies(response)).not.toContain("authjs.session-token");
  });
});
