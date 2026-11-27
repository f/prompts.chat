"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface TagOption {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface TagPickerProps {
  tags: TagOption[];
  value: string[];
  onChange: (value: string[]) => void;
}

/** Selected tags as removable badges plus a search box with suggestions */
export function TagPicker({ tags, value, onChange }: TagPickerProps) {
  const t = useTranslations("prompts");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (tagId: string) =>
    onChange(value.includes(tagId) ? value.filter((id) => id !== tagId) : [...value, tagId]);

  const filteredTags = tags.filter(
    (tag) => !value.includes(tag.id) && tag.name.toLowerCase().includes(search.toLowerCase())
  );
  const selectedTags = tags.filter((tag) => value.includes(tag.id));

  return (
    <>
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color, color: "white" }}
              className="pr-1 flex items-center gap-1"
            >
              {tag.name}
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                className="ml-1 rounded-full hover:bg-white/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={t("searchTags")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              // Enter picks the first suggestion instead of submitting the surrounding form
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (search && filteredTags[0]) {
                toggle(filteredTags[0].id);
                setSearch("");
              }
            }}
            className="pl-9"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            data-form-type="other"
          />
        </div>
        {open && filteredTags.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  toggle(tag.id);
                  setSearch("");
                  inputRef.current?.focus();
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                {tag.name}
              </button>
            ))}
          </div>
        )}
        {open && search && filteredTags.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground">
            {t("noTagsFound")}
          </div>
        )}
      </div>
    </>
  );
}
