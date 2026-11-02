import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import createMDX from "@next/mdx";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    // Plugin names keep loader options serializable for Turbopack.
    remarkPlugins: ["remark-gfm"],
  },
});

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactCompiler: true,
  // Configure webpack for raw imports
  webpack: (config) => {
    config.module.rules.push({
      resourceQuery: /raw/,
      type: 'asset/source',
    });
    return config;
  },
  // Enable standalone output for Docker
  output: "standalone",
  outputFileTracingIncludes: {
    "/my-library": ["./prompts.csv"],
    "/my-library/export": ["./prompts.csv"],
  },
  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Render metadata in <head> before the body streams for crawlers. Next.js only does
  // this for its built-in list of HTML-limited bots, which leaves out Googlebot and AI
  // crawlers; they would otherwise find the title, canonical and robots tags in <body>.
  htmlLimitedBots:
    /bot|crawler|spider|slurp|google-|-google|googleother|bingpreview|lighthouse|facebookexternalhit|facebookcatalog|externalagent|perplexity|whatsapp|ia_archiver|vkshare|quora link preview|skypeuripreview|yeti|tumblr|yandex|sogou|googleweblight/i,
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Raw dataset exports duplicate the prompt pages, so keep them out of search results
  async headers() {
    return [
      {
        source: "/prompts.:format(csv|json)",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ];
  },
  // Redirects
  async redirects() {
    return [
      {
        source: "/vibe",
        destination: "/categories/vibe",
        permanent: true,
      },
      {
        source: "/sponsors",
        destination: "/categories/sponsors",
        permanent: true,
      },
      {
        source: "/embed-preview",
        destination: "/embed",
        permanent: true,
      },
      {
        source: "/builder",
        destination: "/developers",
        permanent: true,
      },
      {
        source: "/how_to_write_effective_prompts",
        destination: "/how-to-write-effective-prompts",
        permanent: true,
      },
      // Linked from other sites; the footer "Docs" link points to the self-hosting guide
      {
        source: "/docs",
        destination: "/docs/self-hosting",
        permanent: true,
      },
      {
        source: "/docs/guide",
        destination: "/docs/self-hosting",
        permanent: true,
      },
      // Redirect book PDF downloads to GitHub raw to save Vercel edge bandwidth
      {
        source: "/book-pdf/:filename",
        destination: "https://raw.githubusercontent.com/f/prompts.chat/refs/heads/main/public/book-pdf/:filename",
        permanent: false,
      },
    ];
  },
};

export default withSentryConfig(withMDX(withNextIntl(nextConfig)), {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "promptschat",

  project: "prompts-chat",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // tunnelRoute removed — was proxying all browser Sentry events through Vercel edge,
  // generating unnecessary edge requests ($2.45/M) and function invocations ($0.60/M).
  // Estimated savings: $100-400/month. Trade-off: some ad-blockers may block direct Sentry calls.
  // See: https://github.com/f/prompts.chat/issues/1085

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
