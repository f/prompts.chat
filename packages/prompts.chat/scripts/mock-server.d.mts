export interface MockRequest {
  path: string;
  query: Record<string, string>;
  userAgent?: string;
}

export interface MockServer {
  url: string;
  requests: MockRequest[];
  close: () => Promise<void>;
}

export const fixtures: {
  prompts: Array<Record<string, unknown> & { id: string; title: string; type: string; content: string }>;
  privatePromptId: string;
  bot: Record<string, unknown> & { id: string; slug: string; name: string };
  team: Record<string, unknown> & { slug: string; title: string };
};

export function startMockServer(): Promise<MockServer>;
