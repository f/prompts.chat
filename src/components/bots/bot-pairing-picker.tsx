"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BotAvatar } from "@/components/bots/bot-avatar";
import {
  BOT_PAIRING_NOTE_MAX_LENGTH,
  MAX_BOT_PAIRINGS,
  isBotColor,
  isBotIconName,
  type BotColor,
  type BotIconName,
} from "@/lib/bots/schema";

export interface BotPairingValue {
  botId: string;
  title: string;
  icon: BotIconName | null;
  color: BotColor | null;
  note: string;
}

interface SearchResult {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface BotPairingPickerProps {
  /** The bot being edited, never offered as its own pair */
  botId?: string;
  value: BotPairingValue[];
  onChange: (value: BotPairingValue[]) => void;
}

const SEARCH_LIMIT = 8;

/** Searches public bots to pair with, and edits the note of each selected pair */
export function BotPairingPicker({ botId, value, onChange }: BotPairingPickerProps) {
  const t = useTranslations("bots.form");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = search.trim();

  useEffect(() => {
    if (!query) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        // A comma would split the query into separate keywords on /api/bots
        const params = new URLSearchParams({ q: query.replace(/,/g, " "), limit: String(SEARCH_LIMIT + value.length + 1) });
        const response = await fetch(`/api/bots?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search failed");
        const data: { bots: SearchResult[] } = await response.json();
        setResults(data.bots);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, value.length]);

  const selectedIds = new Set(value.map((pairing) => pairing.botId));
  const options = results.filter((bot) => bot.id !== botId && !selectedIds.has(bot.id)).slice(0, SEARCH_LIMIT);
  const isFull = value.length >= MAX_BOT_PAIRINGS;

  const add = (bot: SearchResult) => {
    onChange([
      ...value,
      {
        botId: bot.id,
        title: bot.name,
        icon: bot.icon && isBotIconName(bot.icon) ? bot.icon : null,
        color: bot.color && isBotColor(bot.color) ? bot.color : null,
        note: "",
      },
    ]);
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((pairing, index) => (
            <li key={pairing.botId} className="flex flex-col gap-2 rounded-md border p-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-2 sm:w-56">
                <BotAvatar icon={pairing.icon} color={pairing.color} size="sm" />
                <span className="min-w-0 truncate text-sm font-medium" title={pairing.title}>{pairing.title}</span>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={pairing.note}
                  maxLength={BOT_PAIRING_NOTE_MAX_LENGTH}
                  placeholder={t("pairingNotePlaceholder")}
                  aria-label={t("pairingNoteLabel", { bot: pairing.title })}
                  onChange={(event) =>
                    onChange(value.map((item, i) => (i === index ? { ...item, note: event.target.value } : item)))
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(value.filter((item) => item.botId !== pairing.botId))}
                  aria-label={t("removePairing", { bot: pairing.title })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open && !!query}
          aria-controls="bot-pairing-results"
          aria-label={t("pairingsSearch")}
          placeholder={isFull ? t("pairingsMax", { max: MAX_BOT_PAIRINGS }) : t("pairingsSearch")}
          disabled={isFull}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="pl-9"
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        {open && query && (
          <div
            id="bot-pairing-results"
            role="listbox"
            className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md"
          >
            {options.map((bot) => (
              <button
                key={bot.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => add(bot)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <BotAvatar icon={bot.icon} color={bot.color} size="sm" />
                <span className="min-w-0 truncate">{bot.name}</span>
              </button>
            ))}
            {!loading && options.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">{t("pairingsNoResults")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
