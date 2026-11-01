"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bot, FileText, Plus, Puzzle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CREATE_ITEMS = [
  { key: "prompt", href: "/prompts/new", icon: FileText },
  { key: "skill", href: "/prompts/new?type=SKILL", icon: Puzzle },
  { key: "bot", href: "/bots/new", icon: Bot },
  { key: "team", href: "/bots/teams/new", icon: Users },
] as const;

export function CreateMenu() {
  const t = useTranslations("nav.createMenu");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("label")}>
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {CREATE_ITEMS.map(({ key, href, icon: Icon }) => (
          <DropdownMenuItem key={key} asChild>
            <Link href={href}>
              <Icon className="mr-2 h-4 w-4" />
              {t(key)}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
