import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import config from "@/../prompts.config";
import { ProfileForm } from "@/components/settings/profile-form";
import { ApiKeySettings } from "@/components/settings/api-key-settings";
import { DangerZone } from "@/components/settings/danger-zone";
import type { CustomLink } from "@/components/user/profile-links";
import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo";

// Signed-in or workflow page with no search value
export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

export default async function SettingsPage() {
  const session = await auth();
  const t = await getTranslations("settings");

  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      avatar: true,
      verified: true,
      apiKey: true,
      mcpPromptsPublicByDefault: true,
      bio: true,
      customLinks: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="container max-w-2xl py-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="space-y-6">
        <ProfileForm 
          user={{
            ...user,
            customLinks: user.customLinks as CustomLink[] | null,
          }} 
          showVerifiedSection={!config.homepage?.useCloneBranding} 
        />

        {config.features.mcp !== false && (
          <ApiKeySettings
            initialApiKey={user.apiKey}
            initialPublicByDefault={user.mcpPromptsPublicByDefault}
          />
        )}

        <DangerZone username={user.username} />
      </div>
    </div>
  );
}
