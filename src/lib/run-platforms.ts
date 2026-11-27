// Platform definitions and URL builders shared by the Run button and injected action buttons.

export interface Platform {
  id: string;
  name: string;
  baseUrl: string;
  supportsQuerystring?: boolean;
  isDeeplink?: boolean;
  subOptions?: { name: string; baseUrl: string }[];
  sponsor?: boolean;
}

// Image generation platforms (Mitte.ai)
export const imagePlatforms: Platform[] = [
  {
    id: "mitte-image",
    name: "Mitte.ai",
    baseUrl: "https://mitte.ai",
    sponsor: false,
    subOptions: [
      { name: "Nano Banana", baseUrl: "https://mitte.ai?model=nano-banana" },
      { name: "Nano Banana Pro", baseUrl: "https://mitte.ai?model=nano-banana-pro" },
      { name: "Flux 2 Flex", baseUrl: "https://mitte.ai?model=flux-2-flex" },
      { name: "Flux 2", baseUrl: "https://mitte.ai?model=flux-2" },
    ],
  },
];

// Video generation platforms (Mitte.ai)
export const videoPlatforms: Platform[] = [
  {
    id: "mitte-video",
    name: "Mitte.ai",
    baseUrl: "https://mitte.ai",
    sponsor: false,
    subOptions: [
      { name: "Veo 3.1", baseUrl: "https://mitte.ai?model=veo-31" },
      { name: "Kling 2.6", baseUrl: "https://mitte.ai?model=kling-26" },
      { name: "Sora 2", baseUrl: "https://mitte.ai?model=sora-2" },
      {name: "Remotion", baseUrl: "https://mitte.ai?model=remotion" },
    ],
  },
];

// Code platforms (IDEs + code generation tools)
export const codePlatforms: Platform[] = [
  { id: "commandcode", name: "Command Code", baseUrl: "https://commandcode.ai/?utm_source=prompts.chat", supportsQuerystring: false, sponsor: true },
  { id: "windsurf", name: "Windsurf", baseUrl: "windsurf://", isDeeplink: true, supportsQuerystring: false, sponsor: true },
  { id: "vscode", name: "VS Code", baseUrl: "vscode://GitHub.Copilot-Chat/chat", isDeeplink: true },
  { id: "vscode-insiders", name: "VS Code Insiders", baseUrl: "vscode-insiders://GitHub.Copilot-Chat/chat", isDeeplink: true },
  { id: "cursor", name: "Cursor", baseUrl: "cursor://anysphere.cursor-deeplink/prompt", isDeeplink: true },
  { id: "goose", name: "Goose", baseUrl: "goose://recipe", isDeeplink: true },
    {
    id: "github-copilot",
    name: "GitHub Copilot",
    baseUrl: "https://github.com/copilot",
    subOptions: [
      { name: "Copilot Chat", baseUrl: "https://github.com/copilot" },
      { name: "Copilot Agents", baseUrl: "https://github.com/copilot/agents" },
    ],
  },
  { id: "netlify", name: "Netlify", baseUrl: "https://app.netlify.com/run" },
  { id: "bolt", name: "Bolt", baseUrl: "https://bolt.new" },
  { id: "lovable", name: "Lovable", baseUrl: "https://lovable.dev" },
  { id: "v0", name: "v0", baseUrl: "https://v0.dev/chat" },
  { id: "ai2sql", name: "AI2SQL", baseUrl: "https://builder.ai2sql.io/dashboard/builder-all-lp?tab=generate" },
];

// Chat platforms (AI assistants)
export const chatPlatforms: Platform[] = [
  { id: "chatgpt", name: "ChatGPT", baseUrl: "https://chatgpt.com" },
  { id: "claude", name: "Claude", baseUrl: "https://claude.ai/new" },
  { id: "copilot", name: "Microsoft Copilot", baseUrl: "https://copilot.microsoft.com", supportsQuerystring: false },
  { id: "deepseek", name: "DeepSeek", baseUrl: "https://chat.deepseek.com", supportsQuerystring: false },
  { id: "fal", name: "fal.ai Sandbox", baseUrl: "https://fal.ai/sandbox" },
  { id: "gemini", name: "Gemini", baseUrl: "https://gemini.google.com/app", supportsQuerystring: false },
  { id: "goose", name: "Goose", baseUrl: "goose://recipe", isDeeplink: true },
  {
    id: "grok",
    name: "Grok",
    baseUrl: "https://grok.com/chat?reasoningMode=none",
    subOptions: [
      { name: "Grok", baseUrl: "https://grok.com/chat?reasoningMode=none" },
      { name: "Grok Deep Search", baseUrl: "https://grok.com/chat?reasoningMode=deepsearch" },
      { name: "Grok Think", baseUrl: "https://grok.com/chat?reasoningMode=think" },
    ],
  },
  { id: "huggingface", name: "HuggingChat", baseUrl: "https://huggingface.co/chat" },
  { id: "llama", name: "Meta AI", baseUrl: "https://www.meta.ai" },
  { id: "manus", name: "Manus", baseUrl: "https://manus.im/app" },
  { id: "mistral", name: "Le Chat", baseUrl: "https://chat.mistral.ai/chat" },
  { id: "perplexity", name: "Perplexity", baseUrl: "https://www.perplexity.ai" },
  { id: "phind", name: "Phind", baseUrl: "https://www.phind.com" },
  { id: "pi", name: "Pi", baseUrl: "https://pi.ai", supportsQuerystring: false },
  { id: "poe", name: "Poe", baseUrl: "https://poe.com", supportsQuerystring: false },
  { id: "you", name: "You.com", baseUrl: "https://you.com" },
];

// Coding agents that are only offered by injected action buttons, not the Run button.
// They have no prefill URL, so they use the copy-and-open flow.
export const agentPlatforms: Platform[] = [
  { id: "claude-code", name: "Claude Code", baseUrl: "https://claude.ai/code", supportsQuerystring: false },
  { id: "codex", name: "Codex", baseUrl: "https://chatgpt.com/codex", supportsQuerystring: false },
];

export function getPlatformById(id: string): Platform | undefined {
  return [...chatPlatforms, ...codePlatforms, ...agentPlatforms].find((platform) => platform.id === id);
}

export function buildUrl(platformId: string, baseUrl: string, promptText: string, promptTitle?: string, promptDescription?: string): string {
  const encoded = encodeURIComponent(promptText);
  
  switch (platformId) {
    // IDE deeplinks
    case "cursor":
      return `${baseUrl}?text=${encoded}`;
    case "vscode":
    case "vscode-insiders":
      return `${baseUrl}?prompt=${encoded}`;
    case "goose": {
      const config = JSON.stringify({
        version: "1.0.0",
        title: promptTitle || "Prompt",
        description: promptDescription || "",
        instructions: "This is a prompt imported from [**prompts.chat**](https://prompts.chat). Follow the instructions below to complete the task.",
        prompt: promptText,
        activities: [
          "message:This prompt was imported from [**prompts.chat**](https://prompts.chat). Follow the instructions below to complete the task.",
          "Do it now",
          "Learn more about the instructions"
        ]
      });
      const base64Config = btoa(config);
      return `${baseUrl}?config=${base64Config}`;
    }
    // Web platforms
    case "ai2sql":
      return `${baseUrl}&prompt=${encoded}`;
    case "bolt":
      return `${baseUrl}?prompt=${encoded}`;
    case "chatgpt":
      return `${baseUrl}/?q=${encoded}`;
    case "claude":
      return `${baseUrl}?q=${encoded}`;
    case "copilot":
      return `${baseUrl}/?q=${encoded}`;
    case "deepseek":
      return `${baseUrl}/?q=${encoded}`;
    case "github-copilot":
      return `${baseUrl}?prompt=${encoded}`;
    case "grok":
      return `${baseUrl}&q=${encoded}`;
    case "fal":
      return `${baseUrl}?prompt=${encoded}`;
    case "huggingface":
      return `${baseUrl}/?prompt=${encoded}`;
    case "lovable":
      return `${baseUrl}/?autosubmit=true#prompt=${encoded}`;
    case "netlify":
      return `${baseUrl}?prompt=${encoded}&ref=prompts-chat`;
    case "mistral":
      return `${baseUrl}?q=${encoded}`;
    case "perplexity":
      return `${baseUrl}/search?q=${encoded}`;
    case "phind":
      return `${baseUrl}/search?q=${encoded}`;
    case "poe":
      return `${baseUrl}/?q=${encoded}`;
    case "v0":
      return `${baseUrl}?q=${encoded}`;
    case "you":
      return `${baseUrl}/search?q=${encoded}`;
    case "mitte-image":
    case "mitte-video":
      return `${baseUrl}&prompt=${encoded}`;
    default:
      return `${baseUrl}?q=${encoded}`;
  }
}
