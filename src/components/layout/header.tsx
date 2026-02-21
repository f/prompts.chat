"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Schoolbell } from "next/font/google";

const kidsFont = Schoolbell({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-kids",
});

// Mini Promi icon for header
function MiniPromi({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 16 20" 
      className={className}
      style={{ imageRendering: "pixelated" }}
    >
      <rect x="7" y="0" width="2" height="2" fill="#FFD700" />
      <rect x="6" y="2" width="4" height="2" fill="#C0C0C0" />
      <rect x="2" y="4" width="12" height="8" fill="#4A90D9" />
      <rect x="4" y="6" width="3" height="3" fill="white" />
      <rect x="9" y="6" width="3" height="3" fill="white" />
      <rect x="5" y="7" width="2" height="2" fill="#333" />
      <rect x="10" y="7" width="2" height="2" fill="#333" />
      <rect x="6" y="10" width="4" height="1" fill="#333" />
      <rect x="5" y="9" width="1" height="1" fill="#333" />
      <rect x="10" y="9" width="1" height="1" fill="#333" />
      <rect x="4" y="12" width="8" height="6" fill="#4A90D9" />
      <rect x="6" y="14" width="4" height="2" fill="#FFD700" />
    </svg>
  );
}
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import {
  Menu,
  Plus,
  User,
  Settings,
  LogOut,
  Shield,
  Globe,
  Moon,
  Sun,
  Copy,
  ExternalLink,
  Chromium,
  Hammer,
  BookOpen,
  MoreHorizontal,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { setLocale } from "@/lib/i18n/client";
import { useBranding } from "@/components/providers/branding-provider";
import { analyticsAuth, analyticsSettings, analyticsExternal } from "@/lib/analytics";
import { isChromeBrowser, isFirefoxBrowser } from "@/lib/utils";

const FIREFOX_ADDON_URL = "https://addons.mozilla.org/firefox/downloads/file/4675190/prompts_chat-1.4.1.xpi";

const languages = [
  { code: "en", name: "English" },
  { code: "zh", name: "简体中文" },
  { code: "zh-tw", name: "繁體中文" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "de", name: "Deutsch" },
  { code: "nl", name: "Dutch" },
  { code: "it", name: "Italiano" },
  { code: "ja", name: "日本語" },
  { code: "tr", name: "Türkçe" },
  { code: "az", name: "Azərbaycan dili" },
  { code: "ko", name: "한국어" },
  { code: "ar", name: "العربية" },
  { code: "fa", name: "فارسی" },
  { code: "ru", name: "Русский" },
  { code: "he", name: "עברית" },
  { code: "el", name: "Ελληνικά" }
];

interface HeaderProps {
  authProvider?: string;
  allowRegistration?: boolean;
}

export function Header({ authProvider = "credentials", allowRegistration = true }: HeaderProps) {
  const isOAuth = authProvider !== "credentials";
  const { data: session } = useSession();
  const t = useTranslations();
  const { theme, setTheme } = useTheme();
  const branding = useBranding();
  const router = useRouter();
  const pathname = usePathname();

  const user = session?.user;
  const isAdmin = user?.role === "ADMIN";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [browserType, setBrowserType] = useState<"chrome" | "firefox" | null>(null);

  useEffect(() => {
    if (isFirefoxBrowser()) {
      setBrowserType("firefox");
    } else if (isChromeBrowser()) {
      setBrowserType("chrome");
    }
  }, []);

  const handleCopyLogoSvg = async () => {
    try {
      const logoUrl = theme === "dark" ? (branding.logoDark || branding.logo) : branding.logo;
      if (!logoUrl) return;
      const response = await fetch(logoUrl);
      const svgContent = await response.text();
      await navigator.clipboard.writeText(svgContent);
    } catch (error) {
      console.error("Failed to copy logo:", error);
    }
  };

  return (
    <header className="sticky top-[0px] z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={`flex h-12 items-center gap-4 ${pathname === "/developers" ? "px-4" : "container"}`}>
        {/* Mobile menu */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" className="-ml-2 h-8 w-8">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center gap-3 p-6 border-b">
                {branding.logo && (
                  <>
                    <Image
                      src={branding.logo}
                      alt={branding.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 dark:hidden"
                    />
                    <Image
                      src={branding.logoDark || branding.logo}
                      alt={branding.name}
                      width={32}
                      height={32}
                      className="h-8 w-8 hidden dark:block"
                    />
                  </>
                )}
                <span className="text-lg font-semibold mt-2">{branding.name}</span>
              </div>

              {/* Navigation */}
              <nav className="flex-1 p-4">
                <div className="space-y-1">
                  {user && (
                    <>
                      <Link 
                        href="/collection" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        {t("nav.collection")}
                      </Link>
                      <Link 
                        href="/feed" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                      >
                        {t("nav.feed")}
                      </Link>
                    </>
                  )}
                  <Link 
                    href="/prompts" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {t("nav.prompts")}
                  </Link>
                  <Link 
                    href="/skills" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {t("nav.skills")}
                  </Link>
                  <Link 
                    href="/workflows" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {t("nav.workflows")}
                  </Link>
                  <Link 
                    href="/categories" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {t("nav.categories")}
                  </Link>
                  <Link 
                    href="/tags" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {t("nav.tags")}
                  </Link>
                  <Link 
                    href="/discover" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {t("feed.discover")}
                  </Link>
                  <Link 
                    href="/promptmasters" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    {t("nav.promptmasters")}
                  </Link>
                  {!branding.useCloneBranding && (
                    <Link 
                      href="https://fka.gumroad.com/l/art-of-chatgpt-prompting" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <BookOpen className="h-4 w-4" />
                      {t("nav.book")}
                    </Link>
                  )}
                  {!branding.useCloneBranding && (
                    <a 
                      href="/kids" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium hover:bg-accent transition-colors ${kidsFont.className}`}
                    >
                      <MiniPromi className="h-5 w-4" />
                      <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                        {t("nav.forKids")}
                      </span>
                    </a>
                  )}
                </div>
              </nav>

              {/* Footer */}
              <div className="p-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  {branding.name}
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        {!branding.useCloneBranding ? (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <Link href="/" className="flex gap-2">
                {branding.logo && (
                  <>
                    <Image
                      src={branding.logo}
                      alt={branding.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 dark:hidden"
                    />
                    <Image
                      src={branding.logoDark || branding.logo}
                      alt={branding.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 hidden dark:block"
                    />
                  </>
                )}
                <span className="font-semibold leading-none mt-[2px]">{branding.name}</span>
              </Link>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={handleCopyLogoSvg}>
                <Copy className="mr-2 h-4 w-4" />
                {t("brand.copyLogoSvg")}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => router.push("/brand")}>
                <ExternalLink className="mr-2 h-4 w-4" />
                {t("brand.brandAssets")}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ) : (
          <Link href="/" className="flex gap-2">
            {branding.logo && (
              <>
                <Image
                  src={branding.logo}
                  alt={branding.name}
                  width={20}
                  height={20}
                  className="h-5 w-5 dark:hidden"
                />
                <Image
                  src={branding.logoDark || branding.logo}
                  alt={branding.name}
                  width={20}
                  height={20}
                  className="h-5 w-5 hidden dark:block"
                />
              </>
            )}
            <span className="font-semibold leading-none mt-[2px]">{branding.name}</span>
          </Link>
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {user && (
            <>
              <Link
                href="/collection"
                className="px-3 py-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
              >
                {t("nav.collection")}
              </Link>
              <Link
                href="/feed"
                className="px-3 py-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
              >
                {t("nav.feed")}
              </Link>
            </>
          )}
          <Link
            href="/prompts"
            className="px-3 py-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            {t("nav.prompts")}
          </Link>
          <Link
            href="/skills"
            className="px-3 py-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            {t("nav.skills")}
          </Link>
          <Link
            href="/workflows"
            className="px-3 py-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            {t("nav.workflows")}
          </Link>
          {/* Categories, Tags, Promptmasters - visible on lg+ screens */}
          <Link
            href="/categories"
            className="hidden 2xl:block px-3 py-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            {t("nav.categories")}
          </Link>
          <Link
            href="/tags"
            className="hidden 2xl:block px-3 py-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            {t("nav.tags")}
          </Link>
          <Link
            href="/promptmasters"
            className="hidden 2xl:block px-3 py-1.5 rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-accent"
          >
            {t("nav.promptmasters")}
          </Link>
          {/* Three-dot dropdown for Categories, Tags, Promptmasters on md screens */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="2xl:hidden h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">{t("nav.more")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href="/categories">
                  {t("nav.categories")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/tags">
                  {t("nav.tags")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/promptmasters">
                  {t("nav.promptmasters")}
                </Link>
              </DropdownMenuItem>
              {!branding.useCloneBranding && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="https://fka.gumroad.com/l/art-of-chatgpt-prompting">
                      <BookOpen className="mr-2 h-4 w-4" />
                      {t("nav.book")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="/kids" className={kidsFont.className}>
                      <MiniPromi className="mr-2 h-4 w-4" />
                      <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                        {t("nav.forKids")}
                      </span>
                    </a>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuItem asChild>
                <Link href="/developers">
                  <Hammer className="mr-2 h-4 w-4" />
                  {t("nav.developers")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side actions */}
        <div className="flex items-center gap-1">
          {/* Book link */}
          {!branding.useCloneBranding && (
            <Button asChild variant="ghost" size="sm" className="hidden 2xl:flex h-8 gap-1.5">
              <Link href="https://fka.gumroad.com/l/art-of-chatgpt-prompting">
                <BookOpen className="h-4 w-4" />
                {t("nav.book")}
              </Link>
            </Button>
          )}

          {/* For Kids link */}
          {!branding.useCloneBranding && (
            <a 
              href="/kids" 
              className={`hidden 2xl:flex items-center gap-1 px-2 py-1 rounded-md hover:bg-accent transition-colors ${kidsFont.className}`}
            >
              <MiniPromi className="h-5 w-4" />
              <span className="text-sm font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">
                {t("nav.forKids")}
              </span>
            </a>
          )}

          {/* Developers link */}
          <Button asChild variant="ghost" size="icon" className="hidden 2xl:flex h-8 w-8">
            <Link href="/developers" title={t("nav.developers")}>
              <Hammer className="h-4 w-4" />
              <span className="sr-only">{t("nav.developers")}</span>
            </Link>
          </Button>

          {/* Create prompt button */}
          {user && (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <Link href="/prompts/new">
                <Plus className="h-4 w-4" />
                <span className="sr-only">{t("prompts.create")}</span>
              </Link>
            </Button>
          )}

          {/* Notifications */}
          {user && <NotificationBell />}

          {browserType && branding.chromeExtensionUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              asChild
            >
              <a
                href={browserType === "firefox" ? FIREFOX_ADDON_URL : branding.chromeExtensionUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => analyticsExternal.clickChromeExtension()}
              >
                {browserType === "firefox" ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="#FF7139">
                    <path d="M20.452 3.445a11.002 11.002 0 00-2.482-1.908C16.944.997 15.098.093 12.477.032c-.734-.017-1.457.03-2.174.144-.72.114-1.398.292-2.118.56-1.017.377-1.996.975-2.574 1.554.583-.349 1.476-.733 2.55-.992a10.083 10.083 0 013.729-.167c2.341.34 4.178 1.381 5.48 2.625a8.066 8.066 0 011.298 1.587c1.468 2.382 1.33 5.376.184 7.142-.85 1.312-2.67 2.544-4.37 2.53-.583-.023-1.438-.152-2.25-.566-2.629-1.343-3.021-4.688-1.118-6.306-.632-.136-1.82.13-2.646 1.363-.742 1.107-.7 2.816-.242 4.028a6.473 6.473 0 01-.59-1.895 7.695 7.695 0 01.416-3.845A8.212 8.212 0 019.45 5.399c.896-1.069 1.908-1.72 2.75-2.005-.54-.471-1.411-.738-2.421-.767C8.31 2.583 6.327 3.061 4.7 4.41a8.148 8.148 0 00-1.976 2.414c-.455.836-.691 1.659-.697 1.678.122-1.445.704-2.994 1.248-4.055-.79.413-1.827 1.668-2.41 3.042C.095 9.37-.2 11.608.14 13.989c.966 5.668 5.9 9.982 11.843 9.982C18.62 23.971 24 18.591 24 11.956a11.93 11.93 0 00-3.548-8.511z"/>
                  </svg>
                ) : (
                  <Chromium className="h-4 w-4" />
                )}
                <span className="sr-only">Get Browser Extension</span>
              </a>
            </Button>
          )}

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              const newTheme = theme === "dark" ? "light" : "dark";
              analyticsSettings.changeTheme(newTheme);
              setTheme(newTheme);
            }}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* User menu or login */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 gap-2 px-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                    <AvatarFallback className="text-xs">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium">
                    @{user.username}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      @{user.username}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/@${user.username}`}>
                    <User className="mr-2 h-4 w-4" />
                    {t("nav.profile")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("nav.settings")}
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Shield className="mr-2 h-4 w-4" />
                      {t("nav.admin")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Globe className="mr-2 h-4 w-4" />
                    {t("settings.language")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {languages.map((lang) => (
                      <DropdownMenuItem
                        key={lang.code}
                        onClick={() => {
                          analyticsSettings.changeLanguage(lang.code);
                          setLocale(lang.code);
                        }}
                      >
                        {lang.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  analyticsAuth.logout();
                  signOut({ callbackUrl: "/" });
                }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-1">
              {/* Language selector for non-logged in users */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Globe className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => {
                        analyticsSettings.changeLanguage(lang.code);
                        setLocale(lang.code);
                      }}
                    >
                      {lang.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                <Link href="/login">{t("nav.login")}</Link>
              </Button>
              {authProvider === "credentials" && allowRegistration && (
                <Button size="sm" className="h-8 text-xs" asChild>
                  <Link href="/register">
                    {t("nav.register")}
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
