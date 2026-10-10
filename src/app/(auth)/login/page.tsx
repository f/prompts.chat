import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getConfig } from "@/lib/config";
import { getConfiguredProviderIds, getProviderMetadata } from "@/lib/auth/provider-metadata";
import { AuthContent } from "@/components/auth/auth-content";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your account",
};

export default async function LoginPage() {
  const t = await getTranslations("auth");
  const config = await getConfig();
  const providers = getConfiguredProviderIds(config);
  const hasCredentials = providers.includes("credentials");
  const hasOnlyCredentials = providers.length === 1 && hasCredentials;
  const useCloneBranding = config.homepage?.useCloneBranding ?? false;
  const { displayNames, logos } = getProviderMetadata(providers);

  return (
    <div className="container flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center py-8">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">{t("login")}</h1>
          <p className="text-xs text-muted-foreground">
            {hasOnlyCredentials ? t("loginDescription") : t("loginDescriptionOAuth")}
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <AuthContent providers={providers} mode="login" useCloneBranding={useCloneBranding} providerDisplayNames={displayNames} providerLogos={logos} />
        </div>
        {hasCredentials && (
          <p className="text-center text-xs text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-foreground hover:underline">{t("register")}</Link>
          </p>
        )}
      </div>
    </div>
  );
}
#my sample change