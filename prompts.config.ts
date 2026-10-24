import { defineConfig } from "@/lib/config";

// White-label mode ON: hide all prompts.chat repo branding,
// achievements (Forbes/GitHub stars), and sponsor links.
const useCloneBranding = true;

export default defineConfig({
  // Branding — swap logo/favicon for your design-system assets in /public
  branding: {
    name: "Vyaxis Prompt Library",
    logo: "/logo.svg",
    logoDark: "/logo-dark.svg",
    favicon: "/logo.svg",
    description: "Governed prompt catalog for Vyaxis agents, BidIQ, and the acquisition stack.",
    // NOTE: appStoreUrl / chromeExtensionUrl intentionally removed (clone branding).
  },

  // Theme — primary is a placeholder; set from your Vyaxis design-system token.
  theme: {
    radius: "sm",
    variant: "default",
    density: "default",
    colors: {
      primary: "#6366f1", // TODO: replace with Vyaxis accent hex
    },
  },

  // Auth — GitHub (your Vyaxis-LLC / RoblImvp org) + credentials for staff
  // without GitHub accounts. Registration locked; you seed the admin.
  auth: {
    providers: ["github", "credentials"],
    allowRegistration: false,
  },

  // English only for internal use (add "es" if dealership staff need it).
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },

  // Features
  features: {
    privatePrompts: true,
    changeRequests: true,
    categories: true,
    tags: true,
    // AI search/gen need an OpenAI(-compatible) key + embedding model.
    aiSearch: false,
    aiGeneration: false,
    // MCP on: API-key generation so agents can pull prompts programmatically.
    mcp: true,
    comments: true,
  },

  // Homepage — clone branding hides repo achievements + sponsors.
  homepage: {
    useCloneBranding,
    achievements: { enabled: !useCloneBranding },
sponsors: { enabled: !useCloneBranding, items: [] },
  },
});
