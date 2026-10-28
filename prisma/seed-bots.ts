import { PrismaClient, Prisma, BotPlatform } from "@prisma/client";
import { botPlatformsData, canonicalPair, type BotColor, type BotIconName } from "../src/lib/bots/schema";

interface ExampleBot {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  botPlatforms: BotPlatform[];
  botIcon: BotIconName;
  botColor: BotColor;
  /** Placeholder: set to the Grok Bot template share URL once it exists on x.ai */
  installUrl: string | null;
  botConfig: Prisma.InputJsonObject;
}

// Fixed ids keep the example bot URLs stable across re-seeds
export const EXAMPLE_BOTS: ExampleBot[] = [
  {
    id: "example-bot-grok",
    slug: "x-morning-briefing-example",
    title: "X Morning Briefing (Example)",
    description:
      "Example bot. Every morning it reads your home timeline and the X Lists you follow, groups the posts into topics, and sends you a five-bullet briefing with links to the most discussed posts.",
    content: `You are a concise news editor for the user's X account.

- Read the user's home timeline and followed Lists for the requested time window.
- Group posts into at most five topics. For each topic write one sentence and link the two most engaged posts.
- Prefer primary sources (official accounts, authors, researchers) over reposts.
- Never post, like, repost or reply on the user's behalf.
- Keep the whole briefing under 200 words.`,
    botPlatforms: ["GROK_BOT"],
    botIcon: "newspaper",
    botColor: "sky",
    installUrl: null,
    botConfig: {
      routines: [
        {
          name: "Morning briefing",
          type: "schedule",
          trigger: "0 8 * * *",
          triggerLabel: "Every day at 08:00",
          prompt: "Read my home timeline and followed Lists from the last 12 hours and send me the morning briefing.",
        },
        {
          name: "Breaking topic alert",
          type: "event",
          trigger: "A topic in my Lists gets more than 50 posts within an hour",
          triggerLabel: "When a topic spikes in your Lists",
          prompt: "Send me a two-sentence summary of the spiking topic with the three best source posts.",
        },
      ],
      skills: [],
      connectors: ["X"],
    },
  },
  {
    id: "example-bot-openclaw",
    slug: "github-issue-triager-example",
    title: "GitHub Issue Triager (Example)",
    description:
      "Example bot. When a new issue is opened it applies labels and asks for reproduction steps when they are missing. Every Monday it posts a summary of stale issues to your chat.",
    content: `You are a friendly open source maintainer assistant.

- Classify each new issue as bug, feature, question or docs and apply the matching label.
- If a bug report has no reproduction steps or version info, comment once and politely ask for them.
- Never close issues and never assign people.
- Keep comments under 80 words and sign them as "triage bot".`,
    botPlatforms: ["OPENCLAW", "HERMES"],
    botIcon: "bug",
    botColor: "orange",
    installUrl: null,
    botConfig: {
      routines: [
        {
          name: "Triage new issues",
          type: "event",
          trigger: "GitHub webhook: issues.opened",
          triggerLabel: "When a new issue is opened",
          prompt: "Triage the issue from the webhook payload following your instructions.",
        },
        {
          name: "Weekly stale sweep",
          type: "schedule",
          trigger: "0 9 * * 1",
          triggerLabel: "Every Monday at 09:00",
          prompt: "List open issues with no activity in the last 30 days and send me a short summary grouped by label.",
        },
      ],
      skills: [
        { name: "github", description: "Read and label issues and post comments through the GitHub CLI.", source: "" },
      ],
      connectors: ["GitHub"],
    },
  },
  {
    id: "example-bot-hermes",
    slug: "arxiv-research-digest-example",
    title: "arXiv Research Digest (Example)",
    description:
      "Example bot. Each weekday it searches arXiv for new papers on your topics and sends a digest with a one-line takeaway per paper to your Telegram chat.",
    content: `You are a research assistant who follows the user's topics on arXiv.

- Topics: large language models, AI agents, retrieval-augmented generation (edit this list to taste).
- Pick at most eight papers per digest, ranked by relevance to the topics.
- For each paper give the title, authors, link and one plain-language takeaway.
- Skip papers you have already sent in previous digests.`,
    botPlatforms: ["HERMES", "OPENCLAW", "AUTOGPT"],
    botIcon: "graduation-cap",
    botColor: "violet",
    installUrl: null,
    botConfig: {
      routines: [
        {
          name: "Daily digest",
          type: "schedule",
          trigger: "0 7 * * 1-5",
          triggerLabel: "Weekdays at 07:00",
          prompt: "Search arXiv for papers from the last 24 hours on my topics and send me the digest.",
        },
      ],
      skills: [{ name: "arxiv", description: "Search and read arXiv papers.", source: "official/research/arxiv" }],
      connectors: ["Telegram"],
    },
  },
];

/** "Better together with" links between the example bots */
export const EXAMPLE_BOT_PAIRINGS: { a: string; b: string; note: string }[] = [
  {
    a: "example-bot-grok",
    b: "example-bot-hermes",
    note: "Both arrive before work: the X briefing covers the conversation, the arXiv digest the new papers behind it.",
  },
  {
    a: "example-bot-openclaw",
    b: "example-bot-hermes",
    note: "Turn papers from the digest into tracked GitHub issues, then let the triager keep them labeled.",
  },
];

/** Creates the example bots if they don't exist yet. Existing rows are left untouched. */
export async function seedExampleBots(prisma: PrismaClient, authorId: string): Promise<number> {
  let created = 0;
  for (const { id, botPlatforms, ...bot } of EXAMPLE_BOTS) {
    const existing = await prisma.prompt.findUnique({ where: { id }, select: { id: true } });
    if (existing) continue;

    await prisma.prompt.create({
      data: {
        id,
        ...bot,
        ...botPlatformsData(botPlatforms),
        type: "BOT",
        authorId,
        versions: {
          create: { version: 1, content: bot.content, changeNote: "Initial version", createdBy: authorId },
        },
      },
    });
    created++;
  }
  await prisma.botPairing.createMany({
    data: EXAMPLE_BOT_PAIRINGS.map(({ a, b, note }) => ({ ...canonicalPair(a, b), note })),
    skipDuplicates: true,
  });
  return created;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const usernameArg = process.argv.find((arg) => arg.startsWith("--author="))?.slice("--author=".length);
    const author = usernameArg
      ? await prisma.user.findUnique({ where: { username: usernameArg }, select: { id: true, username: true } })
      : await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true, username: true } });

    if (!author) {
      throw new Error(usernameArg ? `User "${usernameArg}" not found` : "No admin user found. Pass --author=<username>.");
    }

    const created = await seedExampleBots(prisma, author.id);
    console.log(`✅ Created ${created} example bots (author: @${author.username})`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith("seed-bots.ts")) {
  main().catch((error) => {
    console.error("❌ Seeding example bots failed:", error);
    process.exit(1);
  });
}
