/**
 * Generates a URL path for a prompt, including the slug if available
 * Format: /prompts/{id} or /prompts/{id}_{slug}
 */
export function getPromptUrl(id: string, slug?: string | null): string {
  if (slug) {
    return `/prompts/${id}_${slug}`;
  }
  return `/prompts/${id}`;
}

/**
 * Generates a URL path for a bot (a prompt of type BOT)
 * Format: /bots/{id} or /bots/{id}_{slug}
 */
export function getBotUrl(id: string, slug?: string | null): string {
  return slug ? `/bots/${id}_${slug}` : `/bots/${id}`;
}

export function getBotTeamUrl(slug: string): string {
  return `/bots/teams/${slug}`;
}

export function getBotTeamEditUrl(slug: string): string {
  return `${getBotTeamUrl(slug)}/edit`;
}

/**
 * Generates edit URL for a prompt
 */
export function getPromptEditUrl(id: string, slug?: string | null): string {
  return `${getPromptUrl(id, slug)}/edit`;
}

/**
 * Generates changes URL for a prompt
 */
export function getPromptChangesUrl(id: string, slug?: string | null): string {
  return `${getPromptUrl(id, slug)}/changes/new`;
}
