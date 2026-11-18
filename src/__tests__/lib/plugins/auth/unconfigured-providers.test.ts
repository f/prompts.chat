// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { applePlugin } from "@/lib/plugins/auth/apple";
import { azurePlugin } from "@/lib/plugins/auth/azure";
import { githubPlugin } from "@/lib/plugins/auth/github";
import { googlePlugin } from "@/lib/plugins/auth/google";

// Regression coverage for #1025: listing a provider in PCHAT_AUTH_PROVIDERS
// without its credentials used to make NextAuth throw a `Configuration` error
// and take the whole login page down. Each provider must instead report itself
// as unconfigured so `buildAuthConfig` can drop it and keep the rest working.
const providers = [
  {
    name: "Google",
    plugin: googlePlugin,
    vars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    name: "GitHub",
    plugin: githubPlugin,
    vars: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  },
  {
    // AZURE_AD_TENANT_ID is optional for the guard itself, but Entra ID needs
    // an issuer to build a valid provider, so it is set here as well.
    name: "Azure AD",
    plugin: azurePlugin,
    vars: ["AZURE_AD_CLIENT_ID", "AZURE_AD_CLIENT_SECRET", "AZURE_AD_TENANT_ID"],
  },
  {
    name: "Apple",
    plugin: applePlugin,
    vars: ["AUTH_APPLE_ID", "AUTH_APPLE_SECRET"],
  },
];

for (const { name, plugin, vars } of providers) {
  describe(`${name} auth provider`, () => {
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
    });

    it("builds a provider when its credentials are set", () => {
      for (const key of vars) {
        vi.stubEnv(key, "test-value");
      }

      expect(plugin.getProvider()).not.toBeNull();
    });

    it("returns null instead of throwing when its credentials are empty", () => {
      for (const key of vars) {
        vi.stubEnv(key, "");
      }

      expect(plugin.getProvider()).toBeNull();
    });

    it("returns null when only some of its credentials are set", () => {
      const [first, ...rest] = vars;
      vi.stubEnv(first, "test-value");
      for (const key of rest) {
        vi.stubEnv(key, "");
      }

      expect(plugin.getProvider()).toBeNull();
    });

    it("warns which provider was disabled", () => {
      for (const key of vars) {
        vi.stubEnv(key, "");
      }
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

      plugin.getProvider();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining(name));
    });
  });
}
