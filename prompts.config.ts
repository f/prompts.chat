import { defineConfig } from "@/lib/config";

// Set to true to use clone branding (hide prompts.chat repo branding)
const useCloneBranding = false;

export default defineConfig({
  // Branding - customize for white-label
  branding: {
    name: "prompts.chat",
    logo: "/logo.svg",
    logoDark: "/logo-dark.svg",
    favicon: "/logo.svg",
    description: "Collect, organize, and share AI prompts",

    // Delete this if useCloneBranding is true
    appStoreUrl: "https://apps.apple.com/tr/app/prompts-chat/id6756895736",
    chromeExtensionUrl: "https://chromewebstore.google.com/detail/promptschat/eemdohkhbaifiocagjlhibfbhamlbeej",
  },

  // Theme - design system configuration
  theme: {
    // Border radius: "none" | "sm" | "md" | "lg"
    radius: "sm",
    // UI style: "flat" | "default" | "brutal"
    variant: "default",
    // Spacing density: "compact" | "default" | "comfortable"
    density: "default",
    // Colors (hex or oklch)
    colors: {
      primary: "#6366f1", // Indigo
    },
  },

  // Authentication plugins
  auth: {
    // Available: "credentials" | "google" | "azure" | "github" | "apple" | custom
    // Use `providers` array to enable multiple auth providers
    providers: ["github", "google", "apple"],
    // Allow public registration (only applies to credentials provider)
    allowRegistration: false,
  },

  // Internationalization
  i18n: {
    locales: ["en", "tr", "es", "zh-tw", "zh", "ja", "ar", "pt", "fr", "it", "de", "nl", "ko", "ru", "he", "el", "az", "fa"],
    defaultLocale: "en",
  },

  // Features
  features: {
    // Allow users to create private prompts
    privatePrompts: true,
    // Enable change request system for versioning
    changeRequests: true,
    // Enable categories
    categories: true,
    // Enable tags
    tags: true,
    // Enable AI-powered semantic search (requires OPENAI_API_KEY)
    aiSearch: true,
    // Enable AI-powered generation features (requires OPENAI_API_KEY)
    aiGeneration: true,
    // Enable MCP (Model Context Protocol) features including API key generation
    mcp: true,
    // Enable comments on prompts
    comments: true,
  },

  // Homepage customization
  homepage: {
    // Set to true to hide prompts.chat repo branding and use your own branding
    useCloneBranding,
    achievements: {
      enabled: !useCloneBranding,
    },
    sponsors: {
      enabled: !useCloneBranding,
      items: [
        // Add sponsors here
        { name: "Clemta", logo: '/sponsors/clemta.webp', url: "https://clemta.com/?utm_source=prompts.chat" },
        { name: "Wiro.ai", className: 'py-1', darkLogo: '/sponsors/wiro.png', logo: '/sponsors/wiro.png', url: "https://wiro.ai/?utm_source=prompts.chat" },
        { name: "Cognition", logo: "/sponsors/cognition.svg", url: "https://wind.surf/prompts-chat" },
        { name: "CodeRabbit", className: 'py-1', logo: '/sponsors/coderabbit.svg', darkLogo: '/sponsors/coderabbit-dark.svg', url: "https://coderabbit.link/fatih" },
        { name: "Sentry", className: 'py-1', logo: '/sponsors/sentry.svg', darkLogo: '/sponsors/sentry-dark.svg', url: "https://sentry.io/?utm_source=prompts.chat" },
        { name: "MitteAI", logo: '/sponsors/mitte.svg', darkLogo: '/sponsors/mitte-dark.svg', url: "https://mitte.ai/?utm_source=prompts.chat" },
        { name: "eachlabs", className: 'py-[6px]', logo: '/sponsors/eachlabs.png', darkLogo: '/sponsors/eachlabs-dark.png', url: "https://www.eachlabs.ai/?utm_source=promptschat&utm_medium=referral" },
        { name: "warp.dev", className: 'py-2', logo: '/sponsors/warp.svg', url: "https://warp.dev/?utm_source=prompts.chat" },
      ],
    },
  },
});
