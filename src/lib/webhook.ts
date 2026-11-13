import { db } from "@/lib/db";
import { getWebhookSiteUrl } from "@/lib/app-url";
import { WebhookEvent } from "@prisma/client";

interface PromptData {
  id: string;
  title: string;
  description: string | null;
  content: string;
  type: string;
  mediaUrl: string | null;
  isPrivate: boolean;
  author: {
    username: string;
    name: string | null;
    avatar: string | null;
  };
  category: {
    name: string;
    slug: string;
  } | null;
  tags: { tag: { name: string; slug: string } }[];
}

// Available placeholders for webhook payloads
export const WEBHOOK_PLACEHOLDERS = {
  PROMPT_ID: "{{PROMPT_ID}}",
  PROMPT_TITLE: "{{PROMPT_TITLE}}",
  PROMPT_DESCRIPTION: "{{PROMPT_DESCRIPTION}}",
  PROMPT_CONTENT: "{{PROMPT_CONTENT}}",
  PROMPT_TYPE: "{{PROMPT_TYPE}}",
  PROMPT_URL: "{{PROMPT_URL}}",
  PROMPT_MEDIA_URL: "{{PROMPT_MEDIA_URL}}",
  AUTHOR_USERNAME: "{{AUTHOR_USERNAME}}",
  AUTHOR_NAME: "{{AUTHOR_NAME}}",
  AUTHOR_AVATAR: "{{AUTHOR_AVATAR}}",
  CATEGORY_NAME: "{{CATEGORY_NAME}}",
  TAGS: "{{TAGS}}",
  TIMESTAMP: "{{TIMESTAMP}}",
  SITE_URL: "{{SITE_URL}}",
  CHATGPT_URL: "{{CHATGPT_URL}}",
} as const;

// Slack Block Kit preset for new prompts
export const SLACK_PRESET_PAYLOAD = `{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "{{PROMPT_TITLE}}",
        "emoji": true
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "View Prompt",
            "emoji": true
          },
          "url": "{{PROMPT_URL}}",
          "style": "primary",
          "action_id": "view_prompt"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "Run in ChatGPT",
            "emoji": true
          },
          "url": "{{CHATGPT_URL}}",
          "action_id": "run_chatgpt"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "text": "{{PROMPT_TYPE}}",
            "emoji": true
          },
          "action_id": "type_badge"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "\`\`\`{{PROMPT_CONTENT}}\`\`\`"
      }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "{{PROMPT_DESCRIPTION}}"
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Author:*\\n<{{SITE_URL}}/@{{AUTHOR_USERNAME}}|@{{AUTHOR_USERNAME}}>"
        },
        {
          "type": "mrkdwn",
          "text": "*Category:*\\n{{CATEGORY_NAME}}"
        },
        {
          "type": "mrkdwn",
          "text": "*Tags:*\\n{{TAGS}}"
        }
      ]
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "image",
          "image_url": "{{AUTHOR_AVATAR}}",
          "alt_text": "{{AUTHOR_NAME}}"
        },
        {
          "type": "mrkdwn",
          "text": "Created by *{{AUTHOR_NAME}}* on {{TIMESTAMP}}"
        }
      ]
    },
    {
      "type": "divider"
    }
  ]
}`;

function escapeJsonString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + "...";
}

/**
 * A10: Validates that a URL does not point to private/internal IP ranges.
 * Blocks: 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
 * Also blocks localhost and common internal hostnames.
 */
function isPrivateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost variations
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
    
    // Block common internal hostnames
    if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.localhost')) {
      return true;
    }
    
    // Check for IP addresses in private ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    
    if (match) {
      const [, a, b, c] = match.map(Number);
      
      // 127.0.0.0/8 - Loopback
      if (a === 127) return true;
      
      // 10.0.0.0/8 - Private
      if (a === 10) return true;
      
      // 172.16.0.0/12 - Private (172.16.0.0 - 172.31.255.255)
      if (a === 172 && b >= 16 && b <= 31) return true;
      
      // 192.168.0.0/16 - Private
      if (a === 192 && b === 168) return true;
      
      // 169.254.0.0/16 - Link-local
      if (a === 169 && b === 254) return true;
      
      // 0.0.0.0/8 - Current network
      if (a === 0) return true;
      
      // 224.0.0.0/4 - Multicast
      if (a >= 224 && a <= 239) return true;
      
      // 240.0.0.0/4 - Reserved
      if (a >= 240) return true;
    }
    
    // Block IPv6 loopback and link-local
    if (hostname.startsWith('[')) {
      const ipv6 = hostname.slice(1, -1).toLowerCase();
      if (ipv6 === '::1' || ipv6.startsWith('fe80:') || ipv6.startsWith('fc') || ipv6.startsWith('fd')) {
        return true;
      }
    }
    
    return false;
  } catch {
    // Invalid URL - treat as potentially dangerous
    return true;
  }
}

export { isPrivateUrl };

function replacePlaceholders(template: string, prompt: PromptData): string {
  const siteUrl = getWebhookSiteUrl();
  const promptUrl = `${siteUrl}/prompts/${prompt.id}`;
  const defaultAvatar = `${siteUrl}/default-avatar.png`;
  const chatgptUrl = `https://chat.openai.com/?prompt=${encodeURIComponent(prompt.content)}`;

  const replacements: Record<string, string> = {
    [WEBHOOK_PLACEHOLDERS.PROMPT_ID]: prompt.id,
    [WEBHOOK_PLACEHOLDERS.PROMPT_TITLE]: escapeJsonString(prompt.title),
    [WEBHOOK_PLACEHOLDERS.PROMPT_DESCRIPTION]: escapeJsonString(prompt.description || "No description"),
    [WEBHOOK_PLACEHOLDERS.PROMPT_CONTENT]: escapeJsonString(truncate(prompt.content, 2000)),
    [WEBHOOK_PLACEHOLDERS.PROMPT_TYPE]: prompt.type,
    [WEBHOOK_PLACEHOLDERS.PROMPT_URL]: promptUrl,
    [WEBHOOK_PLACEHOLDERS.PROMPT_MEDIA_URL]: prompt.mediaUrl || "",
    [WEBHOOK_PLACEHOLDERS.AUTHOR_USERNAME]: prompt.author.username,
    [WEBHOOK_PLACEHOLDERS.AUTHOR_NAME]: escapeJsonString(prompt.author.name || prompt.author.username),
    [WEBHOOK_PLACEHOLDERS.AUTHOR_AVATAR]: prompt.author.avatar || defaultAvatar,
    [WEBHOOK_PLACEHOLDERS.CATEGORY_NAME]: prompt.category?.name || "Uncategorized",
    [WEBHOOK_PLACEHOLDERS.TAGS]: prompt.tags.map((t) => t.tag.name).join(", ") || "None",
    [WEBHOOK_PLACEHOLDERS.TIMESTAMP]: new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    [WEBHOOK_PLACEHOLDERS.SITE_URL]: siteUrl,
    [WEBHOOK_PLACEHOLDERS.CHATGPT_URL]: chatgptUrl,
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  return result;
}

export async function triggerWebhooks(event: WebhookEvent, prompt: PromptData): Promise<void> {
  try {
    // Get all enabled webhooks for this event
    const webhooks = await db.webhookConfig.findMany({
      where: {
        isEnabled: true,
        events: {
          has: event,
        },
      },
    });

    if (webhooks.length === 0) {
      return;
    }

    // Send webhooks in parallel (fire and forget)
    const promises = webhooks.map(async (webhook) => {
      try {
        // A10: Validate webhook URL is not targeting private/internal networks
        if (isPrivateUrl(webhook.url)) {
          console.error(`Webhook ${webhook.name} blocked: URL targets private/internal network`);
          return;
        }
        
        const payload = replacePlaceholders(webhook.payload, prompt);
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(webhook.headers as Record<string, string> || {}),
        };

        const response = await fetch(webhook.url, {
          method: webhook.method,
          headers,
          body: payload,
        });

        if (!response.ok) {
          console.error(`Webhook ${webhook.name} failed:`, response.status, await response.text());
        }
      } catch (error) {
        console.error(`Webhook ${webhook.name} error:`, error);
      }
    });

    // Don't await - fire and forget
    Promise.allSettled(promises);
  } catch (error) {
    console.error("Failed to trigger webhooks:", error);
  }
}
