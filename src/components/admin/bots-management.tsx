"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, Filter, Flag, Loader2, Pencil, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BotAvatar } from "@/components/bots/bot-avatar";
import { BotPlatformBadge } from "@/components/bots/bot-platform-badge";
import { resolveBotPlatforms, type BotComputerRequirement, type BotPlatform } from "@/lib/bots/schema";
import { BotComputerBadge } from "@/components/bots/bot-computer-badge";
import { analyticsBot } from "@/lib/analytics";
import { getBotUrl } from "@/lib/urls";

interface AdminBot {
  id: string;
  title: string;
  slug: string | null;
  botPlatform: BotPlatform | null;
  botPlatforms: BotPlatform[];
  botIcon: string | null;
  botColor: string | null;
  computerRequirement?: BotComputerRequirement;
  isPrivate: boolean;
  isUnlisted: boolean;
  isFeatured: boolean;
  viewCount: number;
  createdAt: string;
  deletedAt: string | null;
  author: { id: string; username: string; name: string | null; avatar: string | null };
  _count: { votes: number; reports: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const FILTERS = ["all", "public", "private", "unlisted", "featured", "reported", "deleted"] as const;

export function BotsManagement() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [bots, setBots] = useState<AdminBot[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [botToDelete, setBotToDelete] = useState<AdminBot | null>(null);

  const fetchBots = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: "BOT", page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (filter !== "all") params.set("filter", filter);
      const res = await fetch(`/api/admin/prompts?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bots");
      const data = await res.json();
      setBots(data.prompts);
      setPagination(data.pagination);
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, tCommon]);

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const runAction = async (bot: AdminBot, url: string, init: RequestInit, successMessage: string) => {
    setPendingId(bot.id);
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error("Request failed");
      toast.success(successMessage);
      await fetchBots();
      return true;
    } catch {
      toast.error(tCommon("somethingWentWrong"));
      return false;
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async () => {
    if (!botToDelete) return;
    const deleted = await runAction(botToDelete, `/api/admin/prompts/${botToDelete.id}`, { method: "DELETE" }, t("botsList.deleted"));
    if (deleted) analyticsBot.delete(botToDelete.id);
    setBotToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{t("botsList.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("botsList.description")}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={filter} onValueChange={(value) => { setFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((value) => (
                <SelectItem key={value} value={value}>{t(`promptsList.filters.${value}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          >
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tCommon("search")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 w-full sm:w-[200px]"
              />
            </div>
            <Button type="submit" size="icon" variant="outline" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>

      <div className="space-y-3">
        {loading && bots.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bots.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">{t("botsList.noBots")}</div>
        ) : (
          bots.map((bot) => {
            const botUrl = getBotUrl(bot.id, bot.slug);
            const busy = pendingId === bot.id;
            return (
              <div key={bot.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <BotAvatar icon={bot.botIcon} color={bot.botColor} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium truncate">{bot.title}</h4>
                      {resolveBotPlatforms(bot).map((platform) => (
                        <BotPlatformBadge key={platform} platform={platform} />
                      ))}
                      <BotComputerBadge requirement={bot.computerRequirement} />
                      {bot.isFeatured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                      {bot.isPrivate && (
                        <Badge variant="secondary" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-1" />
                          {t("promptsList.private")}
                        </Badge>
                      )}
                      {bot.isUnlisted && (
                        <Badge variant="outline" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          {t("promptsList.unlisted")}
                        </Badge>
                      )}
                      {bot.deletedAt && <Badge variant="destructive" className="text-xs">{t("promptsList.filters.deleted")}</Badge>}
                      {bot._count.reports > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          <Flag className="h-3 w-3 mr-1" />
                          {bot._count.reports}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bot.viewCount} {t("promptsList.views")} • {bot._count.votes} {t("promptsList.votes")} • {t("promptsList.created")}: {new Date(bot.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={botUrl} target="_blank" prefetch={false}>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title={t("botsList.open")}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`${botUrl}/edit`} prefetch={false}>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title={t("botsList.edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title={tCommon("delete")}
                      onClick={() => setBotToDelete(bot)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={bot.author.avatar || undefined} />
                      <AvatarFallback className="text-xs">{bot.author.name?.[0] || bot.author.username[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground truncate">@{bot.author.username}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={busy || !!bot.deletedAt}
                      onClick={() => runAction(bot, `/api/prompts/${bot.id}/feature`, { method: "POST" }, t("botsList.updated"))}
                    >
                      <Star className="h-3.5 w-3.5" />
                      {bot.isFeatured ? t("botsList.unfeature") : t("botsList.feature")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={busy || !!bot.deletedAt}
                      onClick={() => runAction(bot, `/api/prompts/${bot.id}/unlist`, { method: "POST" }, t("botsList.updated"))}
                    >
                      {bot.isUnlisted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {bot.isUnlisted ? t("botsList.relist") : t("botsList.unlist")}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {t("promptsList.showing", {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm tabular-nums px-2">{page} / {pagination.totalPages}</span>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page === pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!botToDelete} onOpenChange={(open) => !open && setBotToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("botsList.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("botsList.deleteConfirmDescription", { title: botToDelete?.title || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={!!pendingId}>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={!!pendingId} className="bg-destructive hover:bg-destructive/90 text-white">
              {pendingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
