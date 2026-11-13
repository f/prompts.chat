import { BOT_PLATFORM_PARAM, tagNames, type AuthorField, type BotDetail, type BotSummary, type CatalogPrompt, type TeamDetail, type TeamInstallOption, type TeamSummary } from './catalog.js';

export function handle(id: string, slug?: string | null): string {
  return slug ? `${id}_${slug}` : id;
}

/** `@username` for bots (as on the site); teams show the author's display name */
export function authorLabel(author: AuthorField, style: 'handle' | 'name'): string {
  if (typeof author === 'string') return style === 'handle' ? `@${author}` : author;
  return style === 'handle' ? `@${author.username}` : author.name || `@${author.username}`;
}

function truncate(text: string, max: number): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > max ? `${single.slice(0, max - 1)}…` : single;
}

function typeLabel(type: string): string {
  return type === 'TEXT' ? '' : ` [${type.toLowerCase()}]`;
}

export function promptUrl(baseUrl: string, prompt: Pick<CatalogPrompt, 'id' | 'slug' | 'type' | 'classifierSlug'>): string {
  if (prompt.type === 'CLASSIFIER' && prompt.classifierSlug) return `${baseUrl}/classifiers/${prompt.classifierSlug}`;
  if (prompt.type === 'BOT') return `${baseUrl}/bots/${handle(prompt.id, prompt.slug)}`;
  return `${baseUrl}/prompts/${handle(prompt.id, prompt.slug)}`;
}

export function formatPromptList(prompts: CatalogPrompt[], start = 1): string {
  return prompts
    .map((p, i) => {
      const votes = p.voteCount ? `  ▲${p.voteCount}` : '';
      const trending = p.isTrending ? '  trending' : '';
      const lines = [`${start + i}. ${truncate(p.title, 90)}${typeLabel(p.type)}  @${p.author.username}${votes}${trending}`];
      lines.push(`   id: ${p.type === 'CLASSIFIER' ? p.id : handle(p.id, p.slug)}`);
      if (p.description) lines.push(`   ${truncate(p.description, 110)}`);
      return lines.join('\n');
    })
    .join('\n');
}

export function formatPromptDetail(p: CatalogPrompt, baseUrl: string): string {
  const meta = [`by @${p.author.username}`, `type: ${p.type.toLowerCase()}`];
  if (p.voteCount !== undefined) meta.push(`▲${p.voteCount}`);
  if (p.category) meta.push(`category: ${p.category.name}`);
  const tags = tagNames(p.tags);
  const lines = [p.title, meta.join(' · ')];
  if (tags.length) lines.push(`tags: ${tags.join(', ')}`);
  lines.push(`url: ${promptUrl(baseUrl, p)}`);
  if (p.type === 'SKILL') lines.push(`skill file: ${baseUrl}/api/prompts/${p.id}/skill`);
  if (p.mediaUrl) lines.push(`media: ${p.mediaUrl}`);
  if (p.description) lines.push('', p.description);
  lines.push('', '---', '', p.content ?? '');
  return lines.join('\n');
}

export function formatBotList(bots: BotSummary[]): string {
  return bots
    .map((b, i) => {
      const lines = [`${i + 1}. ${truncate(b.name, 90)}  ${authorLabel(b.author, 'handle')}${b.isTrending ? '  trending' : ''}`];
      lines.push(`   id: ${handle(b.id, b.slug)}`);
      lines.push(`   platforms: ${b.platformNames.join(', ') || 'none'}`);
      if (b.description) lines.push(`   ${truncate(b.description, 110)}`);
      return lines.join('\n');
    })
    .join('\n');
}

function itemName(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    for (const key of ['name', 'title', 'slug', 'url']) {
      if (typeof record[key] === 'string') return record[key] as string;
    }
  }
  return '';
}

export function formatBotDetail(b: BotDetail): string {
  const lines = [b.name, `by ${authorLabel(b.author, 'handle')} · platforms: ${b.platformNames.join(', ') || 'none'}`];
  if (b.category) lines.push(`category: ${b.category.name}`);
  if (b.tags?.length) lines.push(`tags: ${b.tags.map((t) => t.name).join(', ')}`);
  if (b.computerRequirements?.length) lines.push(`needs a computer: ${b.computerRequirements.join(', ').toLowerCase()}`);
  lines.push(`url: ${b.urls.page}`, `markdown: ${b.urls.markdown}`, `SKILL.md: ${b.urls.skill}`);
  if (b.description) lines.push('', b.description);
  lines.push('', '## Instructions', '', b.instructions ?? '');
  const skills = (b.skills ?? []).map(itemName).filter(Boolean);
  if (skills.length) lines.push('', '## Skills', '', ...skills.map((s) => `- ${s}`));
  const connectors = (b.connectors ?? []).map(itemName).filter(Boolean);
  if (connectors.length) lines.push('', '## Connectors', '', ...connectors.map((c) => `- ${c}`));
  if (b.routines?.length) {
    lines.push('', '## Routines', '', ...b.routines.map((r) => `- ${r.name} (${r.triggerLabel ?? r.trigger ?? r.type})`));
  }
  if (b.betterTogetherWith?.length) {
    lines.push('', '## Better together with', '');
    for (const pair of b.betterTogetherWith) {
      lines.push(`- ${pair.name} (${handle(pair.id, pair.slug)})${pair.note ? `: ${truncate(pair.note, 110)}` : ''}`);
    }
  }
  if (b.install?.length) {
    lines.push('', '## Install', '');
    const id = handle(b.id, b.slug);
    for (const option of b.install) {
      const name = b.platformNames[b.platforms.indexOf(option.platform)] ?? option.platform;
      const param = BOT_PLATFORM_PARAM[option.platform] ?? option.platform.toLowerCase();
      lines.push(`- ${name}: prompts.chat bot ${id} --install ${param}`);
      if (option.command) lines.push(`  or run: ${option.command}`);
      if (option.installUrl) lines.push(`  or open: ${option.installUrl}`);
    }
  }
  return lines.join('\n');
}

export function formatTeamList(teams: TeamSummary[], start = 1): string {
  return teams
    .map((t, i) => {
      const lines = [`${start + i}. ${truncate(t.title, 90)}  by ${authorLabel(t.author, 'name')}`];
      lines.push(`   slug: ${t.slug}`);
      lines.push(`   members: ${t.members.map((m) => m.role || m.name).join(', ')}`);
      if (t.description) lines.push(`   ${truncate(t.description, 110)}`);
      return lines.join('\n');
    })
    .join('\n');
}

export function formatTeamDetail(t: TeamDetail): string {
  const lines = [t.title, `by ${authorLabel(t.author, 'name')}${t.category ? ` · category: ${t.category.name}` : ''}`];
  if (t.tags?.length) lines.push(`tags: ${t.tags.map((tag) => tag.name).join(', ')}`);
  lines.push(`url: ${t.link}`);
  if (t.platforms?.length) lines.push(`platforms: ${t.platforms.map((p) => p.name).join(', ')}`);
  if (t.description) lines.push('', t.description);
  lines.push('', '## Members', '');
  for (const m of t.members) {
    lines.push(`- ${m.name}${m.role && m.role !== m.name ? ` (${m.role})` : ''}${m.link ? `  ${m.link}` : ''}`);
    if (m.description) lines.push(`  ${truncate(m.description, 110)}`);
  }
  if (t.handoffs?.length) {
    lines.push('', '## Handoffs', '');
    for (const h of t.handoffs) lines.push(`- ${h.fromName} → ${h.toName}${h.label ? `: ${h.label}` : ''}`);
  }
  const params = (t.platforms ?? []).map((p) => BOT_PLATFORM_PARAM[p.platform] ?? p.platform.toLowerCase());
  lines.push('', `Install prompt: prompts.chat team ${t.slug} --install <${params.length ? params.join('|') : 'platform'}>`);
  return lines.join('\n');
}

export function formatInstallOption(option: Pick<TeamInstallOption, 'installPrompt' | 'command'>): string {
  const lines = [option.installPrompt];
  if (option.command) lines.push('', 'Or run:', '', option.command);
  return lines.join('\n');
}
