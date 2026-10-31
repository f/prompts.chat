"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, ArrowRight, ChevronDown, Loader2, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BotAvatar } from "@/components/bots/bot-avatar";
import { useBotSearch, type BotSearchResult } from "@/components/bots/bot-pairing-picker";
import {
  MAX_TEAM_LINKS,
  MAX_TEAM_MEMBERS,
  MIN_TEAM_MEMBERS,
  TEAM_DESCRIPTION_MAX_LENGTH,
  TEAM_LINK_LABEL_MAX_LENGTH,
  TEAM_MEMBER_DESCRIPTION_MAX_LENGTH,
  TEAM_ROLE_MAX_LENGTH,
  TEAM_TITLE_MAX_LENGTH,
  teamLinkIssues,
} from "@/lib/bots/team-schema";
import { isBotColor, isBotIconName, type BotColor, type BotIconName } from "@/lib/bots/schema";
import { getBotTeamUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

export interface TeamEditorMember {
  botId: string;
  title: string;
  icon: BotIconName | null;
  color: BotColor | null;
  role: string;
  /** What this bot does in the team */
  description: string;
}

export interface TeamEditorLink {
  fromBotId: string;
  toBotId: string;
  label: string;
}

export interface TeamEditorValue {
  title: string;
  description: string;
  members: TeamEditorMember[];
  links: TeamEditorLink[];
}

const EMPTY_TEAM: TeamEditorValue = { title: "", description: "", members: [], links: [] };
const SEARCH_LIMIT = 8;

function TeamMemberPicker({ value, onChange }: { value: TeamEditorMember[]; onChange: (value: TeamEditorMember[]) => void }) {
  const t = useTranslations("bots.teams.form");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = search.trim();
  const { loading, results } = useBotSearch(query, SEARCH_LIMIT, value.length);
  const selected = new Set(value.map((member) => member.botId));
  const options = results.filter((bot) => !selected.has(bot.id)).slice(0, SEARCH_LIMIT);
  const isFull = value.length >= MAX_TEAM_MEMBERS;
  const update = (index: number, patch: Partial<TeamEditorMember>) =>
    onChange(value.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const add = (bot: BotSearchResult) => {
    onChange([
      ...value,
      {
        botId: bot.id,
        title: bot.name,
        icon: bot.icon && isBotIconName(bot.icon) ? bot.icon : null,
        color: bot.color && isBotColor(bot.color) ? bot.color : null,
        role: "",
        description: "",
      },
    ]);
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((member, index) => (
            <li key={member.botId} className="space-y-3 rounded-md border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <BotAvatar icon={member.icon} color={member.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={member.title}>{member.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(value.filter((item) => item.botId !== member.botId))}
                  aria-label={t("removeBot", { bot: member.title })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                <Input
                  value={member.role}
                  maxLength={TEAM_ROLE_MAX_LENGTH}
                  placeholder={t("rolePlaceholder")}
                  aria-label={t("roleLabel", { bot: member.title })}
                  onChange={(event) => update(index, { role: event.target.value })}
                />
                <Textarea
                  value={member.description}
                  maxLength={TEAM_MEMBER_DESCRIPTION_MAX_LENGTH}
                  placeholder={t("memberDescriptionPlaceholder")}
                  aria-label={t("memberDescriptionLabel", { bot: member.title })}
                  rows={2}
                  className="min-h-9 resize-y"
                  onChange={(event) => update(index, { description: event.target.value })}
                />
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
          aria-controls="team-bot-results"
          aria-label={t("botsSearch")}
          placeholder={isFull ? t("botsMax", { max: MAX_TEAM_MEMBERS }) : t("botsSearch")}
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
          <div id="team-bot-results" role="listbox" className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
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
            {!loading && options.length === 0 && <p className="p-3 text-sm text-muted-foreground">{t("noResults")}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/** The first pair of members, in team order, that has no handoff yet */
function nextFreePair(members: TeamEditorMember[], links: TeamEditorLink[]): TeamEditorLink | null {
  const used = new Set(links.map((link) => `${link.fromBotId}>${link.toBotId}`));
  for (let i = 0; i < members.length; i++) {
    for (let step = 1; step < members.length; step++) {
      const from = members[i].botId;
      const to = members[(i + step) % members.length].botId;
      if (!used.has(`${from}>${to}`)) return { fromBotId: from, toBotId: to, label: "" };
    }
  }
  return null;
}

function TeamHandoffEditor({
  members,
  value,
  onChange,
}: {
  members: TeamEditorMember[];
  value: TeamEditorLink[];
  onChange: (value: TeamEditorLink[]) => void;
}) {
  const t = useTranslations("bots.teams.form");
  const titles = new Map(members.map((member) => [member.botId, member.title]));
  const next = nextFreePair(members, value);
  const memberIds = members.map((member) => member.botId);
  const rowIssue = (index: number) => {
    const link = value[index];
    const earlier = value.slice(0, index).some((other) => other.fromBotId === link.fromBotId && other.toBotId === link.toBotId);
    return earlier ? t("handoffDuplicate") : teamLinkIssues(memberIds, [link]).length > 0 ? t("handoffSelf") : null;
  };
  /** Adds the missing handoffs from the bot to every other member and back, up to the handoff limit */
  const connectToEveryone = (botId: string) => {
    const used = new Set(value.map((link) => `${link.fromBotId}>${link.toBotId}`));
    const added = memberIds
      .filter((other) => other !== botId)
      .flatMap((other) => [
        { fromBotId: botId, toBotId: other, label: "" },
        { fromBotId: other, toBotId: botId, label: "" },
      ])
      .filter((link) => !used.has(`${link.fromBotId}>${link.toBotId}`));
    onChange([...value, ...added].slice(0, MAX_TEAM_LINKS));
  };
  const update = (index: number, patch: Partial<TeamEditorLink>) =>
    onChange(value.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  if (members.length < MIN_TEAM_MEMBERS) {
    return <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">{t("needTwoBots")}</p>;
  }

  const memberSelect = (selectedId: string, onSelect: (botId: string) => void, label: string) => (
    <Select value={selectedId} onValueChange={onSelect}>
      <SelectTrigger className="h-9 w-full min-w-0 sm:w-40" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {members.map((member) => (
          <SelectItem key={member.botId} value={member.botId}>
            {member.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-2">
      {value.map((link, index) => {
        const from = titles.get(link.fromBotId) ?? "";
        const to = titles.get(link.toBotId) ?? "";
        const issue = rowIssue(index);
        return (
          <div key={index} className={cn("space-y-3 rounded-md border p-3", issue && "border-destructive/60")}>
            <div className="flex items-center gap-2">
              {memberSelect(link.fromBotId, (fromBotId) => update(index, { fromBotId }), t("from"))}
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {memberSelect(link.toBotId, (toBotId) => update(index, { toBotId }), t("to"))}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                aria-label={t("removeHandoff")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Input
              value={link.label}
              maxLength={TEAM_LINK_LABEL_MAX_LENGTH}
              placeholder={t("labelPlaceholder")}
              aria-label={t("labelLabel", { from, to })}
              onChange={(event) => update(index, { label: event.target.value })}
            />
            {issue && <p className="text-sm text-destructive">{issue}</p>}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!next || value.length >= MAX_TEAM_LINKS}
          onClick={() => next && onChange([...value, next])}
        >
          <Plus className="h-4 w-4" />
          {t("addHandoff")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={!next || value.length >= MAX_TEAM_LINKS}>
              <ArrowLeftRight className="h-4 w-4" />
              {t("connectEveryone")}
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {members.map((member) => (
              <DropdownMenuItem key={member.botId} onSelect={() => connectToEveryone(member.botId)}>
                <BotAvatar icon={member.icon} color={member.color} size="sm" className="h-5 w-5" />
                <span className="truncate">{member.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-sm text-muted-foreground">{t("connectEveryoneHint")}</p>
    </div>
  );
}

interface BotTeamEditorProps {
  /** Edit this team; omitted to create a new one */
  team?: TeamEditorValue & { slug: string };
  /** Opens the dialog; defaults to the floating "Create team" button */
  trigger?: ReactNode;
}

/** Dialog to create or edit a team: pick bots with roles, define handoffs, set a title and description */
export function BotTeamEditor({ team, trigger }: BotTeamEditorProps) {
  const t = useTranslations("bots.teams");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isEdit = !!team;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState<TeamEditorValue>(team ?? EMPTY_TEAM);

  const setMembers = (members: TeamEditorMember[]) => {
    const ids = new Set(members.map((member) => member.botId));
    setValue((current) => ({
      ...current,
      members,
      links: current.links.filter((link) => ids.has(link.fromBotId) && ids.has(link.toBotId)),
    }));
  };

  const validationError = (): string | null => {
    if (!value.title.trim()) return t("form.titleRequired");
    if (value.members.length < MIN_TEAM_MEMBERS) return t("form.minBots", { min: MIN_TEAM_MEMBERS });
    if (teamLinkIssues(value.members.map((m) => m.botId), value.links).length > 0) return t("form.handoffInvalid");
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validationError();
    if (error) return void toast.error(error);

    setSaving(true);
    try {
      const response = await fetch(isEdit ? `/api/bots/teams/${team.slug}` : "/api/bots/teams", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value.title,
          description: value.description || null,
          members: value.members.map((member) => ({
            botId: member.botId,
            role: member.role || null,
            description: member.description || null,
          })),
          links: value.links,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.error === "rate_limit") return void toast.error(t("form.rateLimit"));
        if (result.error === "invalid_bots") return void toast.error(t("form.invalidBots"));
        return void toast.error(result.message || tCommon("somethingWentWrong"));
      }
      toast.success(isEdit ? t("form.updated") : t("form.created"));
      setOpen(false);
      if (!isEdit) setValue(EMPTY_TEAM);
      router.push(getBotTeamUrl(result.slug));
      router.refresh();
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="lg" className="fixed bottom-6 right-6 z-40 h-12 rounded-full px-5 shadow-lg">
            <Plus className="h-5 w-5" />
            {t("create")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={submit} className="space-y-6">
          <DialogHeader>
            <DialogTitle>{isEdit ? t("form.editTitle") : t("form.createTitle")}</DialogTitle>
            <DialogDescription>{t("form.intro")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="team-title">{t("form.title")}</Label>
            <Input
              id="team-title"
              value={value.title}
              maxLength={TEAM_TITLE_MAX_LENGTH}
              placeholder={t("form.titlePlaceholder")}
              onChange={(event) => setValue((current) => ({ ...current, title: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="team-description">{t("form.description")}</Label>
            <Textarea
              id="team-description"
              value={value.description}
              maxLength={TEAM_DESCRIPTION_MAX_LENGTH}
              placeholder={t("form.descriptionPlaceholder")}
              aria-describedby="team-description-hint"
              rows={5}
              className="min-h-28 resize-y"
              onChange={(event) => setValue((current) => ({ ...current, description: event.target.value }))}
            />
            <div id="team-description-hint" className="flex justify-between gap-3 text-sm text-muted-foreground">
              <span>{t("form.descriptionHint")}</span>
              <span className="shrink-0 tabular-nums">
                {value.description.length}/{TEAM_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("form.bots")}</Label>
            <p className="text-sm text-muted-foreground">{t("form.botsHint", { min: MIN_TEAM_MEMBERS, max: MAX_TEAM_MEMBERS })}</p>
            <TeamMemberPicker value={value.members} onChange={setMembers} />
          </div>

          <div className="space-y-2">
            <Label>{t("form.handoffs")}</Label>
            <p className="text-sm text-muted-foreground">{t("form.handoffsHint")}</p>
            <TeamHandoffEditor
              members={value.members}
              value={value.links}
              onChange={(links) => setValue((current) => ({ ...current, links }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t("form.save") : t("form.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Create team" floating button; signed-out visitors are sent to log in first */
export function CreateTeamButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useTranslations("bots.teams");
  if (isLoggedIn) return <BotTeamEditor />;
  return (
    <Button size="lg" className="fixed bottom-6 right-6 z-40 h-12 rounded-full px-5 shadow-lg" asChild>
      <Link href="/login" title={t("loginToCreate")}>
        <Users className="h-5 w-5" />
        {t("create")}
      </Link>
    </Button>
  );
}
