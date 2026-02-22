import { registerBuiltInAuthPlugins } from "./auth";
import { registerBuiltInStoragePlugins } from "./storage";
import { getAuthPlugin } from "./registry";
import { getConfig } from "@/lib/config";

// Export all types
export * from "./types";
export * from "./registry";
export * from "./widgets";

// Initialize all built-in plugins
let initialized = false;

export function initializePlugins(): void {
  if (initialized) return;
  
  registerBuiltInAuthPlugins();
  registerBuiltInStoragePlugins();
  
  initialized = true;
}

// Helper to get providers from config (supports both old `provider` and new `providers` array)
function getProviderIds(config: Awaited<ReturnType<typeof getConfig>>): string[] {
  if (config.auth.providers && config.auth.providers.length > 0) {
    return config.auth.providers;
  }
  if (config.auth.provider) {
    return [config.auth.provider];
  }
  return ["credentials"];
}

/**
 * Get the configured auth plugins based on prompts.config.ts
 */
export async function getConfiguredAuthPlugins() {
  initializePlugins();
  const config = await getConfig();
  const providerIds = getProviderIds(config);
  
  const plugins = providerIds
    .map((id) => getAuthPlugin(id))
    .filter((p): p is NonNullable<typeof p> => p !== null && p !== undefined);
  
  if (plugins.length === 0) {
    throw new Error(
      `No auth plugins found for configured providers: ${providerIds.join(", ")}. ` +
      `Available plugins: credentials, google, azure, github`
    );
  }
  
  return plugins;
}

