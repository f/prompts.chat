import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderTree, Tags, FileText } from "lucide-react";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { UsersTable } from "@/components/admin/users-table";
import { CategoriesTable } from "@/components/admin/categories-table";
import { TagsTable } from "@/components/admin/tags-table";
import { WebhooksTable } from "@/components/admin/webhooks-table";
import { PromptsManagement } from "@/components/admin/prompts-management";
import { ReportsTable } from "@/components/admin/reports-table";
import { BotsManagement } from "@/components/admin/bots-management";
import { TeamsManagement } from "@/components/admin/teams-management";
import { isAISearchEnabled } from "@/lib/ai/embeddings";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage your application",
  robots: NOINDEX_ROBOTS,
};

export default async function AdminPage() {
  const session = await auth();
  const t = await getTranslations("admin");

  // Check if user is admin
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch stats and AI search status
  const [userCount, promptCount, categoryCount, tagCount, aiSearchEnabled] = await Promise.all([
    db.user.count(),
    db.prompt.count(),
    db.category.count(),
    db.tag.count(),
    isAISearchEnabled(),
  ]);
  
  // Count prompts without embeddings and total public prompts
  let promptsWithoutEmbeddings = 0;
  let totalPublicPrompts = 0;
  if (aiSearchEnabled) {
    [promptsWithoutEmbeddings, totalPublicPrompts] = await Promise.all([
      db.prompt.count({
        where: {
          isPrivate: false,
          deletedAt: null,
          embedding: { equals: Prisma.DbNull },
        },
      }),
      db.prompt.count({
        where: {
          isPrivate: false,
          deletedAt: null,
        },
      }),
    ]);
  }

  // Count prompts without slugs
  const [promptsWithoutSlugs, totalPrompts] = await Promise.all([
    db.prompt.count({
      where: {
        slug: null,
        deletedAt: null,
      },
    }),
    db.prompt.count({
      where: {
        deletedAt: null,
      },
    }),
  ]);

  // Fetch data for tables (users are fetched client-side with pagination)
  const [categories, tags, webhooks, reports] = await Promise.all([
    db.category.findMany({
      orderBy: [{ parentId: "asc" }, { order: "asc" }],
      include: {
        _count: {
          select: {
            prompts: true,
            children: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.tag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            prompts: true,
          },
        },
      },
    }),
    db.webhookConfig.findMany({
      orderBy: { createdAt: "desc" },
    }),
    db.promptReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        prompt: {
          select: {
            id: true,
            slug: true,
            title: true,
            isUnlisted: true,
            deletedAt: true,
          },
        },
        reporter: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="container py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.users")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.prompts")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{promptCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.categories")}</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categoryCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.tags")}</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tagCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <AdminTabs
        translations={{
          users: t("tabs.users"),
          categories: t("tabs.categories"),
          tags: t("tabs.tags"),
          webhooks: t("tabs.webhooks"),
          prompts: t("tabs.prompts"),
          bots: t("tabs.bots"),
          teams: t("tabs.teams"),
          reports: t("tabs.reports"),
        }}
        pendingReportsCount={reports.filter(r => r.status === "PENDING").length}
        children={{
          users: <UsersTable />,
          categories: <CategoriesTable categories={categories} />,
          tags: <TagsTable tags={tags} />,
          webhooks: <WebhooksTable webhooks={webhooks} />,
          prompts: (
            <PromptsManagement 
              aiSearchEnabled={aiSearchEnabled} 
              promptsWithoutEmbeddings={promptsWithoutEmbeddings}
              totalPublicPrompts={totalPublicPrompts}
              promptsWithoutSlugs={promptsWithoutSlugs}
              totalPrompts={totalPrompts}
            />
          ),
          bots: <BotsManagement />,
          teams: <TeamsManagement />,
          reports: <ReportsTable reports={reports} />,
        }}
      />
    </div>
  );
}
