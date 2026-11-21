export const DEFAULT_BASE_URL = 'https://prompts.chat';
export const BASE_URL_ENV = 'PROMPTS_CHAT_URL';

declare const __CLI_VERSION__: string | undefined;

export const CLI_VERSION: string = typeof __CLI_VERSION__ === 'string' ? __CLI_VERSION__ : '0.0.0-dev';

export const USER_AGENT = `prompts.chat-cli/${CLI_VERSION} (+https://github.com/f/prompts.chat)`;

/**
 * Resolves the instance the CLI talks to: the --base-url flag, then PROMPTS_CHAT_URL,
 * then prompts.chat. Self-hosted instances serve the same public API.
 */
export function resolveBaseUrl(flag?: string, env: NodeJS.ProcessEnv = process.env): string {
  const raw = (flag || env[BASE_URL_ENV] || DEFAULT_BASE_URL).trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid base URL "${raw}". Expected something like https://prompts.chat`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid base URL "${raw}". Only http and https are supported`);
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

let activeBaseUrl = DEFAULT_BASE_URL;

export function setBaseUrl(baseUrl: string): void {
  activeBaseUrl = baseUrl;
}

export function getBaseUrl(): string {
  return activeBaseUrl;
}
