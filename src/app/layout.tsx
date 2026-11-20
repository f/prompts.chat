import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic, Geist_Mono, Playfair_Display } from "next/font/google";
import { headers } from "next/headers";
import { getMessages, getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CookieConsentBanner } from "@/components/layout/cookie-consent";
import { Analytics } from "@/components/layout/analytics";
import { AppBanner } from "@/components/layout/app-banner";
import { AnnouncementBanner } from "@/components/layout/announcement-banner";
import { LocaleDetector } from "@/components/providers/locale-detector";
import { WebMcpLoader } from "@/components/webmcp/webmcp-loader";
import { getConfig } from "@/lib/config";
import { isRtlLocale } from "@/lib/i18n/config";
import { getBaseUrl } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "prompts.chat - AI Prompts Community",
    template: "%s | prompts.chat",
  },
  description:
    "Discover, collect, and share the best AI prompts for ChatGPT, Claude, Gemini, and more. Join the largest community of AI prompt engineers and creators.",
  keywords: [
    "AI prompts",
    "ChatGPT prompts",
    "Claude prompts",
    "prompt engineering",
    "AI tools",
    "prompt library",
    "GPT prompts",
    "AI assistant",
    "prompt templates",
  ],
  authors: [{ name: "prompts.chat community" }],
  creator: "prompts.chat",
  publisher: "prompts.chat",
  icons: {
    icon: [
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon/favicon.ico", sizes: "48x48" },
    ],
    apple: "/favicon/apple-touch-icon.png",
    shortcut: "/favicon/favicon.svg",
  },
  manifest: "/favicon/site.webmanifest",
  other: {
    "apple-mobile-web-app-title": "prompts.chat",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "prompts.chat",
    title: "prompts.chat - AI Prompts Community",
    description:
      "Discover, collect, and share the best AI prompts for ChatGPT, Claude, Gemini, and more. Join the largest community of AI prompt engineers.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "prompts.chat - AI Prompts Community",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "prompts.chat - AI Prompts Community",
    description:
      "Discover, collect, and share the best AI prompts for ChatGPT, Claude, Gemini, and more.",
    images: ["/og.png"],
    creator: "@promptschat",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const radiusValues = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
};

function hexToOklch(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "oklch(0.5 0.2 260)";
  
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const c = (max - min) * 0.4;
  
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / (max - min)) * 60;
    else if (max === g) h = (2 + (b - r) / (max - min)) * 60;
    else h = (4 + (r - g) / (max - min)) * 60;
  }
  if (h < 0) h += 360;
  
  return `oklch(${(l * 0.8 + 0.2).toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || headersList.get("x-invoke-path") || "";
  const isEmbedRoute = pathname.startsWith("/embed");
  const isKidsRoute = pathname.startsWith("/kids");
  
  const locale = await getLocale();
  const messages = await getMessages();
  const config = await getConfig();
  const isRtl = isRtlLocale(locale);

  // Calculate theme values server-side
  const themeClasses = `theme-${config.theme.variant} density-${config.theme.density}`;
  const primaryOklch = hexToOklch(config.theme.colors.primary);
  const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(config.theme.colors.primary);
  const lightness = rgb 
    ? 0.2126 * (parseInt(rgb[1], 16) / 255) + 0.7152 * (parseInt(rgb[2], 16) / 255) + 0.0722 * (parseInt(rgb[3], 16) / 255)
    : 0.5;
  const foreground = lightness > 0.5 ? "oklch(0.2 0 0)" : "oklch(0.98 0 0)";
  
  const themeStyles = {
    "--radius": radiusValues[config.theme.radius],
    "--primary": primaryOklch,
    "--primary-foreground": foreground,
  } as React.CSSProperties;

  const fontClasses = isRtl 
    ? `${inter.variable} ${notoSansArabic.variable} ${geistMono.variable} ${playfairDisplay.variable} font-arabic` 
    : `${inter.variable} ${geistMono.variable} ${playfairDisplay.variable} font-sans`;

  return (
    <html lang={locale} dir={isRtl ? "rtl" : "ltr"} suppressHydrationWarning className={themeClasses} style={themeStyles}>
      <head>
        {process.env.GOOGLE_ADSENSE_ACCOUNT && (
          <meta name="google-adsense-account" content={process.env.GOOGLE_ADSENSE_ACCOUNT} />
        )}
      </head>
      <body className={`${fontClasses} antialiased`}>
        {process.env.GOOGLE_ANALYTICS_ID && (
          <Analytics gaId={process.env.GOOGLE_ANALYTICS_ID} />
        )}
        <Providers locale={locale} messages={messages} theme={config.theme} branding={{ ...config.branding, useCloneBranding: config.homepage?.useCloneBranding }}>
          {isEmbedRoute || isKidsRoute ? (
            children
          ) : (
            <>
              <LocaleDetector />
              <div className="relative min-h-screen flex flex-col">
                <AnnouncementBanner announcement={config.announcement} />
                <Header authProvider={config.auth.provider} allowRegistration={config.auth.allowRegistration} />
                <main className="flex-1">{children}</main>
                <Footer />
                <CookieConsentBanner />
              </div>
              {config.features.webmcp && <WebMcpLoader color={config.theme.colors.primary} locales={config.i18n.locales} />}
            </>
          )}
        </Providers>
      </body>
    </html>
  );
}
