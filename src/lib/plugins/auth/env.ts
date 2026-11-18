/**
 * Shared guard for the built-in auth provider plugins.
 *
 * NextAuth throws a `Configuration` error while the provider list is being
 * built when a provider is listed in `PCHAT_AUTH_PROVIDERS` without its
 * credentials, which takes down the entire auth surface - including the
 * credentials provider that would otherwise have kept working.
 *
 * `requireAuthEnv` turns that hard failure into a soft one: it returns `null`
 * and warns, so `buildAuthConfig` (src/lib/auth/index.ts) can drop just that
 * provider and keep the remaining configured ones usable.
 *
 * @param providerName Human readable provider name used in the warning.
 * @param env Environment values the provider cannot be built without.
 * @returns The resolved values, or `null` when any of them is missing/empty.
 */
export function requireAuthEnv(
  providerName: string,
  env: Readonly<Record<string, string | undefined>>
): Record<string, string> | null {
  const values: Record<string, string> = {};
  const missing: string[] = [];

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === "") {
      missing.push(key);
    } else {
      values[key] = value;
    }
  }

  if (missing.length > 0) {
    console.warn(
      `Missing ${missing.join(" or ")}. ${providerName} auth provider disabled.`
    );
    return null;
  }

  return values;
}
