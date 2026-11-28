/**
 * Media Generators Plugin Registry
 * 
 * Manages AI-powered media generation plugins for images and videos.
 * 
 * To add a new plugin:
 * 1. Create your plugin file (e.g., ./my-provider.ts) implementing MediaGeneratorPlugin
 * 2. Import and add it to the `plugins` array below
 */

import { wiroGeneratorPlugin } from "./wiro";
import { falGeneratorPlugin } from "./fal";
import { minimaxGeneratorPlugin } from "./minimax";
import type { MediaGeneratorPlugin, MediaGeneratorModel, MediaType, WebSocketHandler } from "./types";

export * from "./types";

/**
 * Register all plugins here - just add your plugin to this array
 */
const plugins: MediaGeneratorPlugin[] = [
  wiroGeneratorPlugin,
  falGeneratorPlugin,
  minimaxGeneratorPlugin,
  // Add new plugins here:
  // myNewPlugin,
];

const mediaGeneratorRegistry = new Map<string, MediaGeneratorPlugin>();

let initialized = false;

function initializeMediaGenerators(): void {
  if (initialized) return;
  plugins.forEach((plugin) => mediaGeneratorRegistry.set(plugin.id, plugin));
  initialized = true;
}

export function getMediaGeneratorPlugin(id: string): MediaGeneratorPlugin | undefined {
  initializeMediaGenerators();
  return mediaGeneratorRegistry.get(id);
}

export function getAllMediaGeneratorPlugins(): MediaGeneratorPlugin[] {
  initializeMediaGenerators();
  return Array.from(mediaGeneratorRegistry.values());
}

export function getEnabledMediaGeneratorPlugins(): MediaGeneratorPlugin[] {
  return getAllMediaGeneratorPlugins().filter((p) => p.isEnabled());
}

/**
 * Get all available models from enabled generators
 */
export function getAvailableModels(type?: MediaType): Array<MediaGeneratorModel & { provider: string; providerName: string; providerLogo?: string; providerLogoDark?: string }> {
  initializeMediaGenerators();

  const models: Array<MediaGeneratorModel & { provider: string; providerName: string; providerLogo?: string; providerLogoDark?: string }> = [];

  for (const plugin of getEnabledMediaGeneratorPlugins()) {
    const pluginModels = plugin.getModels();
    for (const model of pluginModels) {
      if (!type || model.type === type) {
        models.push({
          ...model,
          provider: plugin.id,
          providerName: plugin.name,
          providerLogo: plugin.logo,
          providerLogoDark: plugin.logoDark,
        });
      }
    }
  }

  return models;
}

/**
 * Check if any media generator is available
 */
export function isMediaGenerationAvailable(): boolean {
  initializeMediaGenerators();
  return getEnabledMediaGeneratorPlugins().length > 0;
}

/**
 * Get WebSocket handler for a provider
 */
export function getProviderWebSocketHandler(providerId: string): WebSocketHandler {
  initializeMediaGenerators();
  const plugin = getMediaGeneratorPlugin(providerId);
  if (!plugin) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return plugin.webSocketHandler;
}
