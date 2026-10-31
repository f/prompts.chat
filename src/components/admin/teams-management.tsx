"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, Filter, Loader2, Pencil, Search, Star, Trash2, Users } from "lucide-react";
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
import { getBotTeamUrl } from "@/lib/urls";

interface AdminTeam {
  id: string;
  slug: string;
  title: string;
  isFeatured: boolean;
  isUnlisted: boolean;
  createdAt: string;
  author: { id: string; username: string; name: string | null; avatar: string | null };
  _count: { members: number; votes: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const FILTERS = ["all", "listed", "unlisted", "featured"] as const;

export function TeamsManagement() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<AdminTeam | null>(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (filter !== "all") params.set("filter", filter);
      const res = await fetch(`/api/admin/teams?${params}`);
      if (!res.ok) throw new Error("Failed to fetch teams");
      const data = await res.json();
      setTeams(data.teams);
      setPagination(data.pagination);
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, tCommon]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const runAction = async (team: AdminTeam, init: RequestInit, successMessage: string) => {
    setPendingId(team.id);
    try {
      const res = await fetch(`/api/admin/teams/${team.id}`, init);
      if (!res.ok) throw new Error("Request failed");
      toast.success(successMessage);
      await fetchTeams();
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    } finally {
      setPendingId(null);
    }
  };

  const toggleUnlisted = (team: AdminTeam) =>
    runAction(
      team,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isUnlisted: !team.isUnlisted }) },
      t("teamsList.updated")
    );

  const handleDelete = async () => {
    if (!teamToDelete) return;
    await runAction(teamToDelete, { method: "DELETE" }, t("teamsList.deleted"));
    setTeamToDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{t("teamsList.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("teamsList.description")}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={filter} onValueChange={(value) => { setFilter(value); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((value) => (
                <SelectItem key={value} value={value}>{t(`teamsList.filters.${value}`)}</SelectItem>
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
        {loading && teams.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">{t("teamsList.noTeams")}</div>
        ) : (
          teams.map((team) => {
            const teamUrl = getBotTeamUrl(team.slug);
            const busy = pendingId === team.id;
            return (
              <div key={team.id} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium truncate">{team.title}</h4>
                      {team.isFeatured && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                      {team.isUnlisted && (
                        <Badge variant="outline" className="text-xs">
                          <EyeOff className="h-3 w-3 mr-1" />
                          {t("promptsList.unlisted")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("teamsList.members", { count: team._count.members })} • {team._count.votes} {t("promptsList.votes")} • {t("promptsList.created")}: {new Date(team.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={teamUrl} target="_blank" prefetch={false}>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title={t("teamsList.open")}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`${teamUrl}/edit`} prefetch={false}>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title={t("teamsList.edit")}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title={tCommon("delete")}
                      onClick={() => setTeamToDelete(team)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 text-sm">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={team.author.avatar || undefined} />
                      <AvatarFallback className="text-xs">{team.author.name?.[0] || team.author.username[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-muted-foreground truncate">@{team.author.username}</span>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => toggleUnlisted(team)}>
                    {team.isUnlisted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {team.isUnlisted ? t("teamsList.relist") : t("teamsList.unlist")}
                  </Button>
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

      <AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("teamsList.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("teamsList.deleteConfirmDescription", { title: teamToDelete?.title || "" })}
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
