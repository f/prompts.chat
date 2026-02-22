import { logger } from "@/lib/logger";

export interface BrandingConfig {
  name: string;
  logo: string;
  logoDark?: string;
  favicon: string;
  description: string;
  appStoreUrl?: string;
  chromeExtensionUrl?: string;
}

export interface ThemeConfig {
  // Appearance
  radius: "none" | "sm" | "md" | "lg"; // Border radius
  variant: "flat" | "default" | "brutal"; // UI style variant
  density: "compact" | "default" | "comfortable"; // Spacing density
  // Colors (CSS oklch values or hex)
  colors: {
    primary: string;
    secondary?: string;
    accent?: string;
  };
}

export type AuthProvider = "credentials" | "google" | "azure" | "github" | "apple" | string;

export interface AuthConfig {
  /** @deprecated Use `providers` array instead */
  provider?: AuthProvider;
  /** Array of auth providers to enable (e.g., ["github", "google"]) */
  providers?: AuthProvider[];
  allowRegistration: boolean;
}

export interface I18nConfig {
  locales: string[];
  defaultLocale: string;
}

export interface FeaturesConfig {
  privatePrompts: boolean;
  changeRequests: boolean;
  categories: boolean;
  tags: boolean;
  aiSearch?: boolean;
  aiGeneration?: boolean;
  mcp?: boolean;
  comments?: boolean;
}

export interface Sponsor {
  name: string;
  logo: string;
  darkLogo?: string;
  url: string;
  className?: string;
}

export interface HomepageConfig {
  // Hide prompts.chat repo branding (achievements, GitHub links) and use clone's branding
  useCloneBranding?: boolean;
  achievements?: {
    enabled: boolean;
  };
  sponsors?: {
    enabled: boolean;
    items: Sponsor[];
  };
}

export interface PromptsConfig {
  branding: BrandingConfig;
  theme: ThemeConfig;
  auth: AuthConfig;
  i18n: I18nConfig;
  features: FeaturesConfig;
  homepage?: HomepageConfig;
}

export function defineConfig(config: PromptsConfig): PromptsConfig {
  return config;
}

// Load the user's config
let cachedConfig: PromptsConfig | null = null;

/**
 * Apply runtime environment variable overrides to config.
 * This allows customization via Docker env vars without rebuilding.
 * 
 * All env vars are prefixed with PCHAT_ to avoid conflicts.
 * 
 * Supported env vars:
 *   PCHAT_NAME, PCHAT_DESCRIPTION, PCHAT_LOGO, PCHAT_LOGO_DARK, PCHAT_FAVICON, PCHAT_COLOR
 *   PCHAT_THEME_RADIUS (none|sm|md|lg), PCHAT_THEME_VARIANT (default|flat|brutal), PCHAT_THEME_DENSITY
 *   PCHAT_AUTH_PROVIDERS (comma-separated), PCHAT_ALLOW_REGISTRATION (true|false)
 *   PCHAT_LOCALES (comma-separated), PCHAT_DEFAULT_LOCALE
 *   PCHAT_FEATURE_* (true|false for each feature)
 */
function applyEnvOverrides(config: PromptsConfig): PromptsConfig {
  const env = process.env;
  
  // Helper functions
  const envBool = (key: string, fallback: boolean): boolean => {
    const val = env[key];
    if (val === undefined) return fallback;
    return val.toLowerCase() === 'true' || val === '1';
  };
  
  const envArray = (key: string, fallback: string[]): string[] => {
    const val = env[key];
    if (!val) return fallback;
    return val.split(',').map(s => s.trim()).filter(Boolean);
  };

  return {
    branding: {
      name: env.PCHAT_NAME || config.branding.name,
      description: env.PCHAT_DESCRIPTION || config.branding.description,
      logo: env.PCHAT_LOGO || config.branding.logo,
      logoDark: env.PCHAT_LOGO_DARK || env.PCHAT_LOGO || config.branding.logoDark,
      favicon: env.PCHAT_FAVICON || config.branding.favicon,
      appStoreUrl: config.branding.appStoreUrl,
      chromeExtensionUrl: config.branding.chromeExtensionUrl,
    },
    theme: {
      radius: (env.PCHAT_THEME_RADIUS as ThemeConfig['radius']) || config.theme.radius,
      variant: (env.PCHAT_THEME_VARIANT as ThemeConfig['variant']) || config.theme.variant,
      density: (env.PCHAT_THEME_DENSITY as ThemeConfig['density']) || config.theme.density,
      colors: {
        primary: env.PCHAT_COLOR || config.theme.colors.primary,
        secondary: config.theme.colors.secondary,
        accent: config.theme.colors.accent,
      },
    },
    auth: {
      providers: env.PCHAT_AUTH_PROVIDERS 
        ? envArray('PCHAT_AUTH_PROVIDERS', config.auth.providers || ['credentials'])
        : config.auth.providers,
      allowRegistration: env.PCHAT_ALLOW_REGISTRATION !== undefined
        ? envBool('PCHAT_ALLOW_REGISTRATION', config.auth.allowRegistration)
        : config.auth.allowRegistration,
    },
    i18n: {
      locales: env.PCHAT_LOCALES 
        ? envArray('PCHAT_LOCALES', config.i18n.locales)
        : config.i18n.locales,
      defaultLocale: env.PCHAT_DEFAULT_LOCALE || config.i18n.defaultLocale,
    },
    features: {
      privatePrompts: envBool('PCHAT_FEATURE_PRIVATE_PROMPTS', config.features.privatePrompts),
      changeRequests: envBool('PCHAT_FEATURE_CHANGE_REQUESTS', config.features.changeRequests),
      categories: envBool('PCHAT_FEATURE_CATEGORIES', config.features.categories),
      tags: envBool('PCHAT_FEATURE_TAGS', config.features.tags),
      aiSearch: envBool('PCHAT_FEATURE_AI_SEARCH', config.features.aiSearch ?? false),
      aiGeneration: envBool('PCHAT_FEATURE_AI_GENERATION', config.features.aiGeneration ?? false),
      mcp: envBool('PCHAT_FEATURE_MCP', config.features.mcp ?? false),
      comments: envBool('PCHAT_FEATURE_COMMENTS', config.features.comments ?? true),
    },
    homepage: env.PCHAT_NAME ? {
      // If custom branding via env, use clone branding mode
      useCloneBranding: true,
      achievements: { enabled: false },
      sponsors: { enabled: false, items: [] },
    } : config.homepage,
  };
}

export async function getConfig(): Promise<PromptsConfig> {
  if (cachedConfig) return cachedConfig;

  let baseConfig: PromptsConfig;
  
  try {
    // Dynamic import of user config
    const userConfig = await import("@/../prompts.config");
    baseConfig = userConfig.default;
  } catch {
    // Fallback to default config
    baseConfig = {
      branding: {
        name: "prompts.chat",
        logo: "/logo.svg",
        logoDark: "/logo-dark.svg",
        favicon: "/favicon.ico",
        description: "Collect, organize, and share AI prompts",
      },
      theme: {
        radius: "sm",
        variant: "flat",
        density: "compact",
        colors: {
          primary: "#6366f1",
        },
      },
      auth: {
        providers: ["credentials"],
        allowRegistration: true,
      },
      i18n: {
        locales: ["en"],
        defaultLocale: "en",
      },
      features: {
        privatePrompts: true,
        changeRequests: true,
        categories: true,
        tags: true,
        aiSearch: false,
        aiGeneration: false,
        comments: true,
      },
    };
  }
  
  // Apply runtime environment variable overrides
  cachedConfig = applyEnvOverrides(baseConfig);
  return cachedConfig;
}

// Sync version for client components (must be initialized first)
export function getConfigSync(): PromptsConfig {
  if (!cachedConfig) {
    throw new Error("Config not initialized. Call getConfig() first in a server component.");
  }
  return cachedConfig;
}

/**
 * Validate required environment variables at startup
 * Throws an error if critical environment variables are missing
 */
export function validateEnvironment(): void {
  const required = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }

  // Warn about optional but recommended variables
  const recommended = [
    'NEXTAUTH_URL',
    'OPENAI_API_KEY',
    'GOOGLE_ANALYTICS_ID',
  ];

  const missingRecommended = recommended.filter(key => !process.env[key]);
  if (missingRecommended.length > 0) {
    logger.warn(
      `Optional environment variables not set: ${missingRecommended.join(', ')}. ` +
      `Some features may be limited.`
    );
  }
}
