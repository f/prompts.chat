"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Trophy, Medal, Award, BarChart3, TrendingUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SortMode = "total" | "perPrompt";

interface LeaderboardUser {
  id: string;
  name: string | null;
  username: string;
  avatar: string | null;
  totalUpvotes: number;
  promptCount: number;
}

interface LeaderboardData {
  period: string;
  leaderboard: LeaderboardUser[];
}

interface Translations {
  title: string;
  description: string;
  allTime: string;
  thisMonth: string;
  thisWeek: string;
  noData: string;
  prompts: string;
  upvotes: string;
  perPrompt: string;
  sortByTotal: string;
  sortByRatio: string;
}

interface PromptmastersContentProps {
  translations: Translations;
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Trophy className="h-6 w-6 text-yellow-500" />;
  } else if (rank === 2) {
    return <Medal className="h-6 w-6 text-gray-400" />;
  } else if (rank === 3) {
    return <Award className="h-6 w-6 text-amber-600" />;
  }
  return (
    <span className="w-6 h-6 flex items-center justify-center text-sm font-medium text-muted-foreground">
      {rank}
    </span>
  );
}

function LeaderboardList({ 
  users, 
  sortMode, 
  translations 
}: { 
  users: LeaderboardUser[]; 
  sortMode: SortMode;
  translations: Translations;
}) {
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (sortMode === "perPrompt") {
        const aRatio = a.promptCount > 0 ? a.totalUpvotes / a.promptCount : 0;
        const bRatio = b.promptCount > 0 ? b.totalUpvotes / b.promptCount : 0;
        return bRatio - aRatio;
      }
      return b.totalUpvotes - a.totalUpvotes;
    });
  }, [users, sortMode]);

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {translations.noData}
      </div>
    );
  }

  return (
    <div className="divide-y">
      {sortedUsers.map((user, index) => (
        <Link
          key={user.id}
          href={`/@${user.username}`}
          prefetch={false}
          className="flex items-center gap-4 p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="w-8 flex justify-center">
            <RankBadge rank={index + 1} />
          </div>
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar || undefined} alt={user.name || user.username} />
            <AvatarFallback>
              {(user.name || user.username).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user.name || user.username}</p>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="font-semibold">{user.promptCount}</p>
              <p className="text-xs text-muted-foreground">{translations.prompts}</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-primary">
                {sortMode === "perPrompt" 
                  ? (user.promptCount > 0 ? (user.totalUpvotes / user.promptCount).toFixed(1) : "0")
                  : user.totalUpvotes}
              </p>
              <p className="text-xs text-muted-foreground">
                {sortMode === "perPrompt" ? translations.perPrompt : translations.upvotes}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function PromptmastersContent({ translations }: PromptmastersContentProps) {
  const [allTime, setAllTime] = useState<LeaderboardData | null>(null);
  const [monthly, setMonthly] = useState<LeaderboardData | null>(null);
  const [weekly, setWeekly] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState<SortMode>("total");

  useEffect(() => {
    async function fetchLeaderboards() {
      try {
        const [allRes, monthRes, weekRes] = await Promise.all([
          fetch("/api/leaderboard?period=all"),
          fetch("/api/leaderboard?period=month"),
          fetch("/api/leaderboard?period=week"),
        ]);

        if (allRes.ok) setAllTime(await allRes.json());
        if (monthRes.ok) setMonthly(await monthRes.json());
        if (weekRes.ok) setWeekly(await weekRes.json());
      } catch (error) {
        console.error("Failed to fetch leaderboards:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboards();
  }, []);

  return (
    <div className="container py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            <h1 className="text-3xl font-bold">{translations.title}</h1>
          </div>
          <p className="text-muted-foreground">{translations.description}</p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <div className="flex items-center gap-2 mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">{translations.allTime}</TabsTrigger>
            <TabsTrigger value="month">{translations.thisMonth}</TabsTrigger>
            <TabsTrigger value="week">{translations.thisWeek}</TabsTrigger>
          </TabsList>
          <div className="flex-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortMode(sortMode === "total" ? "perPrompt" : "total")}
                className="shrink-0 cursor-pointer"
              >
                {sortMode === "total" ? (
                  <BarChart3 className="h-4 w-4" />
                ) : (
                  <TrendingUp className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {sortMode === "total" ? translations.sortByTotal : translations.sortByRatio}
            </TooltipContent>
          </Tooltip>
          </div>

          <TabsContent value="all" className="mt-0">
            {loading ? (
              <LeaderboardSkeleton />
            ) : (
              <LeaderboardList users={allTime?.leaderboard || []} sortMode={sortMode} translations={translations} />
            )}
          </TabsContent>

          <TabsContent value="month" className="mt-0">
            {loading ? (
              <LeaderboardSkeleton />
            ) : (
              <LeaderboardList users={monthly?.leaderboard || []} sortMode={sortMode} translations={translations} />
            )}
          </TabsContent>

          <TabsContent value="week" className="mt-0">
            {loading ? (
              <LeaderboardSkeleton />
            ) : (
              <LeaderboardList users={weekly?.leaderboard || []} sortMode={sortMode} translations={translations} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
