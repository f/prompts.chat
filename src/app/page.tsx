import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Star, Heart, Trophy, Users, HeartHandshake, Code, Lock, Building2, Github, GraduationCap, LogIn, Rocket, Quote, History } from "lucide-react";
import { auth } from "@/lib/auth";
import { getConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { DiscoveryPrompts } from "@/components/prompts/discovery-prompts";
import { HeroCategories } from "@/components/prompts/hero-categories";
import { CliCommand } from "@/components/layout/cli-command";
import { ExtensionLink } from "@/components/layout/extension-link";
import { AnimatedText } from "@/components/layout/animated-text";
import { SponsorLink, BecomeSponsorLink, BuiltWithLink } from "@/components/layout/sponsor-link";
import { WebsiteStructuredData } from "@/components/seo/structured-data";import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo.home");
  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/",
    absoluteTitle: true,
    image: "route",
  });
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export default async function HomePage() {
  const tHomepage = await getTranslations("homepage");
  const tNav = await getTranslations("nav");
  const session = await auth();
  const config = await getConfig();
  
  const isOAuth = config.auth.provider !== "credentials";
  // Show register button only for non-logged-in users
  const showRegisterButton = !session && (isOAuth || (config.auth.provider === "credentials" && config.auth.allowRegistration));

  const useCloneBranding = config.homepage?.useCloneBranding ?? false;
  const aiGenerationEnabled = config.features?.aiGeneration ?? false;

  // Fetch GitHub stars dynamically (with caching) - only if not using clone branding
  let githubStars = 139000; // fallback
  if (!useCloneBranding && config.homepage?.achievements?.enabled !== false) {
    try {
      const res = await fetch("https://api.github.com/repos/f/prompts.chat", {
        next: { revalidate: 3600 }, // Cache for 1 hour
      });
      if (res.ok) {
        const data = await res.json();
        githubStars = data.stargazers_count;
      }
    } catch {
      // Use fallback
    }
  }

  // Show landing page for all users
  return (
    <div className="flex flex-col">
      <WebsiteStructuredData />
      {/* Hero Section */}
      <section className="relative py-12 md:py-16 border-b overflow-hidden">
        {/* Background - Right Side */}
        {useCloneBranding ? (
          <div className="absolute top-0 end-0 bottom-0 w-1/2 hidden md:block pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-background via-background/80 to-transparent z-10" />
            <Image
              src={config.branding.logo}
              alt={config.branding.name}
              width={800}
              height={800}
              className="absolute top-1/2 -translate-y-1/2 -end-20 w-[150%] h-auto opacity-15 dark:hidden"
            />
            <Image
              src={config.branding.logoDark || config.branding.logo}
              alt={config.branding.name}
              width={800}
              height={800}
              className="absolute top-1/2 -translate-y-1/2 -end-20 w-[150%] h-auto opacity-10 hidden dark:block"
            />
          </div>
        ) : (
          <div className="absolute top-0 end-0 bottom-0 w-2/5 xl:w-[45%] 2xl:w-1/2 hidden md:block pointer-events-none overflow-hidden">
            {/* Video background */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-background via-background/80 to-transparent z-10" />
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute top-1/2 -translate-y-1/2 end-0 w-full h-auto opacity-30 dark:opacity-15 dark:invert"
              >
                <source src="https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/main/public/animation_compressed.mp4" type="video/mp4" />
              </video>
            </div>
            {/* Animated input overlay and clients */}
            <div className="absolute inset-0 hidden lg:flex flex-col items-center justify-center z-30 pe-8 pointer-events-auto gap-6">
              <HeroCategories />
              {/* Clients Section */}
              <div className="flex flex-col items-center gap-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{tHomepage("clients")}</span>
                <div className="flex items-center gap-3">
                  <CliCommand />
                  {config.branding.appStoreUrl && (
                  <Link
                    href={config.branding.appStoreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 h-10 px-2.5 2xl:px-4 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 dark:border-zinc-600"
                  >
                    <svg className="h-4 w-4 text-zinc-100" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <span className="hidden 2xl:inline text-sm font-medium text-zinc-100 whitespace-nowrap">App Store</span>
                  </Link>
                  )}
                  {config.branding.chromeExtensionUrl && (
                    <ExtensionLink url={config.branding.chromeExtensionUrl} />
                  )}
                  <Link
                    href="raycast://extensions/fka/prompts-chat?source=prompts.chat"
                    className="inline-flex items-center justify-center gap-2 h-10 px-2.5 2xl:px-4 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 dark:border-zinc-600"
                  >
                    <svg className="h-4 w-4 text-zinc-100" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6.004 15.492v2.504L0 11.992l1.258-1.249Zm2.504 2.504H6.004L12.008 24l1.253-1.253zm14.24-4.747L24 11.997 12.003 0 10.75 1.251 15.491 6h-2.865L9.317 2.692 8.065 3.944l2.06 2.06H8.691v9.31H18v-1.432l2.06 2.06 1.252-1.252-3.312-3.32V8.506ZM6.63 5.372 5.38 6.625l1.342 1.343 1.251-1.253Zm10.655 10.655-1.247 1.251 1.342 1.343 1.253-1.251zM3.944 8.059 2.692 9.31l3.312 3.314v-2.506zm9.936 9.937h-2.504l3.314 3.312 1.25-1.252z"/>
                    </svg>
                    <span className="hidden 2xl:inline text-sm font-medium text-zinc-100 whitespace-nowrap">Raycast</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="container relative z-20">
          <div className="max-w-2xl lg:max-w-xl xl:max-w-2xl">
            {useCloneBranding ? (
              <>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl lg:text-5xl !text-2xl sm:!text-3xl md:!text-4xl lg:!text-5xl text-primary">
                  {config.branding.name}
                </h1>
                <p className="mt-6 text-muted-foreground text-lg max-w-xl">
                  {config.branding.description}
                </p>
              </>
            ) : (
              <>
                <h1 className="space-y-0 overflow-visible">
                  <AnimatedText className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter leading-none text-balance">{tHomepage("heroTitle")}</AnimatedText>
                  {/* Keeps the two lines apart as words in the heading's text content */}
                  {" "}
                  <AnimatedText className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl italic font-display tracking-tight leading-none whitespace-nowrap">{tHomepage("heroSubtitle")}</AnimatedText>
                </h1>
                <p className="mt-6 text-muted-foreground text-lg max-w-xl">
                  {tHomepage("heroDescription")}
                </p>
                
                {/* Feature badges */}
                <div className="mt-8 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Code className="h-5 w-5 text-primary" />
                    <span>{tHomepage("heroFeature1")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-5 w-5 text-primary" />
                    <span>{tHomepage("heroFeature2")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building2 className="h-5 w-5 text-primary" />
                    <span>{tHomepage("heroFeature3")}</span>
                  </div>
                </div>
              </>
            )}

            <div className="mt-10 flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href={session ? "/feed" : "/prompts"}>
                    {session ? tHomepage("viewFeed") : tHomepage("browsePrompts")}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                {!useCloneBranding && (
                  <Button variant="outline" size="lg" asChild>
                    <Link href="https://github.com/f/prompts.chat/blob/main/SELF-HOSTING.md" target="_blank" rel="noopener noreferrer">
                      <Github className="mr-1.5 h-4 w-4" />
                      {tHomepage("setupPrivateServer")}
                    </Link>
                  </Button>
                )}
                {showRegisterButton && (
                  <Button variant="outline" size="lg" asChild>
                    <Link href={isOAuth ? "/login" : "/register"}>
                      <LogIn className="mr-1.5 h-4 w-4" />
                      {isOAuth ? tNav("login") : tNav("register")}
                    </Link>
                  </Button>
                )}
              </div>
              {!useCloneBranding && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <Link 
                    href="https://github.com/f/prompts.chat" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Star className="h-4 w-4 text-amber-500" />
                    <span>{tHomepage("beStargazer", { count: (githubStars + 1).toLocaleString(), ordinal: getOrdinalSuffix(githubStars + 1) })}</span>
                  </Link>
                  <Link 
                    href="/about" 
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <History className="h-4 w-4" />
                    {tHomepage("ourHistory")}
                  </Link>
                </div>
              )}
            </div>
            
            {/* Mobile Hero Categories */}
            <div className="mt-8 lg:hidden">
              <HeroCategories />
            </div>

            {/* Tablet Clients Section - hidden on mobile phones */}
            {!useCloneBranding && (
              <div className="mt-8 hidden sm:flex lg:hidden flex-col items-center gap-3">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{tHomepage("clients")}</span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <CliCommand />
                  {config.branding.appStoreUrl && (
                    <Link
                      href={config.branding.appStoreUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 h-10 px-2.5 md:px-4 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 dark:border-zinc-600"
                    >
                      <svg className="h-4 w-4 text-zinc-100" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                      <span className="hidden md:inline text-sm font-medium text-zinc-100 whitespace-nowrap">App Store</span>
                    </Link>
                  )}
                  {config.branding.chromeExtensionUrl && (
                    <ExtensionLink url={config.branding.chromeExtensionUrl} />
                  )}
                  <Link
                    href="raycast://extensions/fka/prompts-chat?source=prompts.chat"
                    className="inline-flex items-center justify-center gap-2 h-10 px-2.5 md:px-4 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-zinc-700 dark:border-zinc-600"
                  >
                    <svg className="h-4 w-4 text-zinc-100" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6.004 15.492v2.504L0 11.992l1.258-1.249Zm2.504 2.504H6.004L12.008 24l1.253-1.253zm14.24-4.747L24 11.997 12.003 0 10.75 1.251 15.491 6h-2.865L9.317 2.692 8.065 3.944l2.06 2.06H8.691v9.31H18v-1.432l2.06 2.06 1.252-1.252-3.312-3.32V8.506ZM6.63 5.372 5.38 6.625l1.342 1.343 1.251-1.253Zm10.655 10.655-1.247 1.251 1.342 1.343 1.253-1.251zM3.944 8.059 2.692 9.31l3.312 3.314v-2.506zm9.936 9.937h-2.504l3.314 3.312 1.25-1.252z"/>
                    </svg>
                    <span className="hidden md:inline text-sm font-medium text-zinc-100 whitespace-nowrap">Raycast</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Sponsors Section */}
      {config.homepage?.sponsors?.enabled && config.homepage.sponsors.items.length > 0 && (
        <section className="py-8 border-b">
          <div className="container">
            {!useCloneBranding && (
              <div className="flex items-center justify-center gap-2 mb-4">
                <p className="text-center text-xs text-muted-foreground">{tHomepage("achievements.sponsoredBy")}</p>
                <BecomeSponsorLink
                  href="https://github.com/sponsors/f/sponsorships?sponsor=f&tier_id=558224&preview=false"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-pink-700 dark:text-pink-300 bg-pink-100 dark:bg-pink-900/30 hover:bg-pink-200 dark:hover:bg-pink-900/50 rounded-full transition-colors border border-pink-200 dark:border-pink-800"
                >
                  <HeartHandshake className="h-3 w-3" />
                  {tHomepage("achievements.becomeSponsor")}
                </BecomeSponsorLink>
              </div>
            )}
            <div className="flex flex-col md:flex-row flex-wrap items-center justify-center gap-4 md:gap-8">
              {config.homepage.sponsors.items.map((sponsor) => (
                <SponsorLink
                  key={sponsor.name}
                  name={sponsor.name}
                  url={sponsor.url}
                  logo={sponsor.logo}
                  darkLogo={sponsor.darkLogo}
                  className={sponsor.className}
                />
              ))}
            </div>
            {!useCloneBranding && (
              <div className="flex flex-col md:flex-row items-center justify-center gap-1.5 mt-4 pt-4 border-t text-xs text-muted-foreground">
                <span><b>prompts.chat</b> is built with</span>
                <span className="inline-flex items-center gap-1.5">
                  <BuiltWithLink href="https://devin.ai/?utm_source=prompts.chat" toolName="Devin">
                    <Image
                      src="/sponsors/devin.svg"
                      alt="Devin"
                      width={80}
                      height={20}
                      className="h-6 w-auto dark:hidden"
                    />
                    <Image
                      src="/sponsors/devin-dark.svg"
                      alt="Devin"
                      width={80}
                      height={20}
                      className="h-6 w-auto hidden dark:block"
                    />
                  </BuiltWithLink>
                  <span>by Cognition</span>
                  <span>and</span>
                  <BuiltWithLink href="https://grok.com/?utm_source=prompts.chat" toolName="Grok Bot">
                    <Image
                      src="/sponsors/grok-bot.svg"
                      alt="Grok Bot"
                      width={80}
                      height={20}
                      className="h-6 w-auto dark:hidden"
                    />
                    <Image
                      src="/sponsors/grok-bot-dark.svg"
                      alt="Grok Bot"
                      width={80}
                      height={20}
                      className="h-6 w-auto hidden dark:block"
                    />
                  </BuiltWithLink>
                  <span className="mx-0.5">·</span>
                  <span>hosted on</span>
                  <Link href="https://vercel.com/oss" target="_blank" rel="noopener noreferrer" className="inline-flex items-center opacity-60 hover:opacity-100 transition-opacity">
                    <Image
                      src="/sponsors/vercel-oss.svg"
                      alt="Vercel OSS Program"
                      width={240}
                      height={24}
                      className="h-4.5 w-auto dark:hidden"
                    />
                    <Image
                      src="/sponsors/vercel-oss-dark.svg"
                      alt="Vercel OSS Program"
                      width={240}
                      height={24}
                      className="h-4.5 w-auto hidden dark:block"
                    />
                  </Link>
                </span>
              </div>
            )}
            {/* Achievements */}
            {config.homepage?.achievements?.enabled !== false && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 md:gap-x-10 md:gap-y-2 text-sm">
                  <Link href="https://www.forbes.com/sites/tjmccue/2023/01/19/chatgpt-success-completely-depends-on-your-prompt/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span>{tHomepage("achievements.featuredIn")} <strong>{tHomepage("achievements.forbes")}</strong></span>
                  </Link>
                  <Link href="https://www.huit.harvard.edu/news/ai-prompts" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <GraduationCap className="h-4 w-4 text-[#A51C30]" />
                    <span>{tHomepage("achievements.referencedBy")} <strong>{tHomepage("achievements.harvardUniversity")}</strong></span>
                  </Link>
                  <Link href="https://etc.cuit.columbia.edu/news/columbia-prompt-library-effective-academic-ai-use" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <GraduationCap className="h-4 w-4 text-[#B9D9EB]" />
                    <span>{tHomepage("achievements.referencedBy")} <strong>{tHomepage("achievements.columbiaUniversity")}</strong></span>
                  </Link>
                  <Link href="https://libguides.olympic.edu/UsingAI/Prompts" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <GraduationCap className="h-4 w-4 text-[#003366]" />
                    <span>{tHomepage("achievements.referencedBy")} <strong>{tHomepage("achievements.olympicCollege")}</strong></span>
                  </Link>
                  <Link href="https://scholar.google.com/citations?user=AZ0Dg8YAAAAJ&hl=en" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <GraduationCap className="h-4 w-4 text-[#4285F4]" />
                    <span><strong>40+</strong> {tHomepage("achievements.academicCitations")}</span>
                  </Link>
                  <Link href="https://github.blog/changelog/2025-02-14-personal-custom-instructions-bing-web-search-and-more-in-copilot-on-github-com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Github className="h-4 w-4" />
                    <span>{tHomepage("achievements.referencedIn")} <strong>{tHomepage("achievements.githubBlog")}</strong></span>
                  </Link>
                  <Link href="https://huggingface.co/datasets/fka/prompts.chat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Heart className="h-4 w-4 text-red-500" />
                    <span>{tHomepage("achievements.mostLikedDataset")}</span>
                  </Link>
                  <Link href="https://github.com/f/prompts.chat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span><strong>{(githubStars / 1000).toFixed(0)}k</strong> {tHomepage("achievements.githubStars")}</span>
                  </Link>
                  <Link href="https://github.com/f/prompts.chat" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Trophy className="h-4 w-4 text-purple-500" />
                    <span>{tHomepage("achievements.mostStarredRepo")}</span>
                  </Link>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-4 w-4 text-green-500" />
                    <span>{tHomepage("achievements.usedByThousands")}</span>
                  </span>
                  <Link href="https://spotlights-feed.github.com/spotlights/prompts-chat/index/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Github className="h-4 w-4 text-purple-600" />
                    <span>{tHomepage("achievements.githubStaffPick")}</span>
                  </Link>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Code className="h-4 w-4 text-blue-500" />
                    <span>{tHomepage("achievements.fullyOpenSource")}</span>
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Rocket className="h-4 w-4 text-orange-500" />
                    <span><strong>{tHomepage("achievements.firstEver")}</strong> · {tHomepage("achievements.releasedOn")}</span>
                  </span>
                </div>
              </div>
            )}
            {/* Testimonials */}
            {!useCloneBranding && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-center text-xs text-muted-foreground mb-6">{tHomepage("achievements.lovedByPioneers")}</p>
                <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                  {/* Greg Brockman */}
                  <Link
                    href="https://x.com/gdb/status/1602072566671110144"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative p-5 rounded-lg border bg-muted/30 overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    <Quote className="absolute top-3 right-3 h-16 w-16 text-muted-foreground/10 -rotate-12" />
                    <div className="relative z-10 flex flex-col gap-3 h-full">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/sponsors/gdb.jpg"
                          alt="Greg Brockman"
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                        <div>
                          <p className="text-sm font-medium">Greg Brockman</p>
                          <p className="text-xs text-muted-foreground">President & Co-Founder at OpenAI · Dec 12, 2022</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground italic leading-relaxed">&ldquo;Love the community explorations of ChatGPT, from capabilities (https://github.com/f/prompts.chat) to limitations (...). No substitute for the collective power of the internet when it comes to plumbing the uncharted depths of a new deep learning model.&rdquo;</p>
                    </div>
                  </Link>
                  {/* Wojciech Zaremba */}
                  <Link
                    href="https://x.com/woj_zaremba/status/1601362952841760769"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative p-5 rounded-lg border bg-muted/30 overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    <Quote className="absolute top-3 right-3 h-16 w-16 text-muted-foreground/10 -rotate-12" />
                    <div className="relative z-10 flex flex-col gap-3 h-full">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/sponsors/woj.jpg"
                          alt="Wojciech Zaremba"
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                        <div>
                          <p className="text-sm font-medium">Wojciech Zaremba</p>
                          <p className="text-xs text-muted-foreground">Co-Founder at OpenAI · Dec 10, 2022</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground italic leading-relaxed">&ldquo;I love it! https://github.com/f/prompts.chat&rdquo;</p>
                    </div>
                  </Link>
                  {/* Clement Delangue */}
                  <Link
                    href="https://x.com/clementdelangue/status/1830976369389642059"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative p-5 rounded-lg border bg-muted/30 overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    <Quote className="absolute top-3 right-3 h-16 w-16 text-muted-foreground/10 -rotate-12" />
                    <div className="relative z-10 flex flex-col gap-3 h-full">
                      <div className="flex items-center gap-3">
                        <Image
                          src="/sponsors/clem.png"
                          alt="Clement Delangue"
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                        <div>
                          <p className="text-sm font-medium">Clement Delangue</p>
                          <p className="text-xs text-muted-foreground">CEO at Hugging Face · Sep 3, 2024</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground italic leading-relaxed">&ldquo;Keep up the great work!&rdquo;</p>
                    </div>
                  </Link>
                  {/* Thomas Dohmke */}
                  <Link
                    href="https://x.com/ashtom/status/1887250944427237816"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative p-5 rounded-lg border bg-muted/30 overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    <Quote className="absolute top-3 right-3 h-16 w-16 text-muted-foreground/10 -rotate-12" />
                    <div className="relative z-10 flex flex-col gap-3 h-full">
                      <div className="flex items-center gap-3">
                        <Image
                          src="https://github.com/ashtom.png"
                          alt="Thomas Dohmke"
                          width={40}
                          height={40}
                          className="rounded-full"
                        />
                        <div>
                          <p className="text-sm font-medium">Thomas Dohmke</p>
                          <p className="text-xs text-muted-foreground">Former CEO at GitHub · Feb 5, 2025</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground italic leading-relaxed">&ldquo;You can now pass prompts to Copilot Chat via URL. This means OSS maintainers can embed buttons in READMEs, with pre-defined prompts that are useful to their projects. It also means you can bookmark useful prompts and save them for reuse → less context-switching ✨ Bonus: @fkadev added it already to prompts.chat 🚀&rdquo;</p>
                    </div>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Featured & Latest Prompts Section */}
      <DiscoveryPrompts isHomepage />

      {/* CTA Section - only show if not using clone branding */}
      {!useCloneBranding && (
        <section className="py-12">
          <div className="container">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-4">
                <Image
                  src={config.branding.logo}
                  alt={config.branding.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 dark:hidden"
                />
                <Image
                  src={config.branding.logoDark || config.branding.logo}
                  alt={config.branding.name}
                  width={48}
                  height={48}
                  className="h-12 w-12 hidden dark:block"
                />
                <div>
                  <h2 className="font-semibold">{tHomepage("readyToStart")}</h2>
                  <p className="text-sm text-muted-foreground">{tHomepage("freeAndOpen")}</p>
                </div>
              </div>
              {showRegisterButton && (
                <Button asChild>
                  <Link href={isOAuth ? "/login" : "/register"}>
                    {isOAuth ? tNav("login") : tHomepage("createAccount")}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
