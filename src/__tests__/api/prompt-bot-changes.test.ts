import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/prompts/[id]/changes/route";
import { PATCH } from "@/app/api/prompts/[id]/changes/[changeId]/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import type { BotFields } from "@/lib/bots/change-snapshot";

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    prompt: { findUnique: vi.fn(), update: vi.fn() },
    promptVersion: { findFirst: vi.fn(), create: vi.fn() },
    changeRequest: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const fields: BotFields = {
  description: "Watches the build",
  platforms: ["OPENCLAW"],
  icon: null,
  color: null,
  computerRequirements: [],
  installUrl: null,
  config: { routines: [], skills: [], connectors: ["github"] },
};

const botPrompt = {
  id: "bot-1",
  authorId: "owner",
  isPrivate: false,
  deletedAt: null,
  type: "BOT",
  title: "CI bot",
  content: "Watch CI",
  description: "Watches the build",
  botPlatform: "OPENCLAW",
  botPlatforms: ["OPENCLAW"],
  botIcon: null,
  botColor: null,
  computerRequirements: [],
  installUrl: null,
  botConfig: { routines: [], skills: [], connectors: ["github"] },
};

const params = { params: Promise.resolve({ id: "bot-1" }) };
const changeParams = { params: Promise.resolve({ id: "bot-1", changeId: "cr-1" }) };

function request(method: string, body: unknown) {
  return new NextRequest("http://localhost/api/prompts/bot-1/changes", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function signIn(id: string) {
  vi.mocked(auth).mockResolvedValue({ user: { id, role: "USER" } } as never);
}

describe("bot change requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.prompt.findUnique).mockResolvedValue(botPrompt as never);
    vi.mocked(db.changeRequest.create).mockImplementation(((args: { data: unknown }) => Promise.resolve({ id: "cr-1", ...(args.data as object) })) as never);
    vi.mocked(db.$transaction).mockImplementation(((operations: Promise<unknown>[]) => Promise.all(operations)) as never);
  });

  it("stores the current and proposed bot fields", async () => {
    signIn("bob");
    const proposedBot = { ...fields, config: { ...fields.config, connectors: ["github", "slack"] } };
    const response = await POST(request("POST", { proposedContent: "Watch CI", proposedBot }), params);
    expect(response.status).toBe(201);
    expect(vi.mocked(db.changeRequest.create).mock.calls[0][0].data).toMatchObject({
      originalContent: "Watch CI",
      originalBot: fields,
      proposedBot,
    });
  });

  it("keeps the bot fields when none are proposed", async () => {
    signIn("bob");
    const response = await POST(request("POST", { proposedContent: "Watch CI closely" }), params);
    expect(response.status).toBe(201);
    const data = vi.mocked(db.changeRequest.create).mock.calls[0][0].data;
    expect(data.proposedBot).toEqual(fields);
  });

  it("rejects a bot proposal that changes nothing", async () => {
    signIn("bob");
    const response = await POST(request("POST", { proposedContent: "Watch CI", proposedTitle: "CI bot", proposedBot: fields }), params);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("no_change");
    expect(db.changeRequest.create).not.toHaveBeenCalled();
  });

  it("rejects bot fields on prompts", async () => {
    signIn("bob");
    vi.mocked(db.prompt.findUnique).mockResolvedValue({ ...botPrompt, type: "TEXT" } as never);
    const response = await POST(request("POST", { proposedContent: "New", proposedBot: fields }), params);
    expect(response.status).toBe(400);
  });

  it("does not accept change requests for deleted bots", async () => {
    signIn("bob");
    vi.mocked(db.prompt.findUnique).mockResolvedValue({ ...botPrompt, deletedAt: new Date() } as never);
    const response = await POST(request("POST", { proposedContent: "New" }), params);
    expect(response.status).toBe(404);
  });

  it("applies approved bot fields and saves them in the version", async () => {
    signIn("owner");
    const proposedBot = { ...fields, description: "Fixes the build" };
    vi.mocked(db.changeRequest.findUnique).mockResolvedValue({
      id: "cr-1",
      promptId: "bot-1",
      status: "PENDING",
      proposedContent: "Fix CI",
      proposedTitle: "CI fixer",
      proposedBot,
      authorId: "bob",
      reason: null,
      author: { username: "bob" },
    } as never);
    vi.mocked(db.promptVersion.findFirst).mockResolvedValue({ version: 2 } as never);

    const response = await PATCH(request("PATCH", { status: "APPROVED" }), changeParams);
    expect(response.status).toBe(200);
    expect(vi.mocked(db.prompt.update).mock.calls[0][0].data).toMatchObject({
      content: "Fix CI",
      title: "CI fixer",
      description: "Fixes the build",
      botConfig: fields.config,
    });
    expect(vi.mocked(db.promptVersion.create).mock.calls[0][0].data).toMatchObject({
      version: 3,
      content: "Fix CI",
      changeNote: "Contribution by @bob",
      botSnapshot: { title: "CI fixer", ...proposedBot },
    });
  });

  it("approves older bot requests without bot fields as title and instructions only", async () => {
    signIn("owner");
    vi.mocked(db.changeRequest.findUnique).mockResolvedValue({
      id: "cr-1",
      promptId: "bot-1",
      status: "PENDING",
      proposedContent: "Fix CI",
      proposedTitle: null,
      proposedBot: null,
      authorId: "bob",
      reason: null,
      author: { username: "bob" },
    } as never);
    vi.mocked(db.promptVersion.findFirst).mockResolvedValue(null);

    const response = await PATCH(request("PATCH", { status: "APPROVED" }), changeParams);
    expect(response.status).toBe(200);
    expect(vi.mocked(db.prompt.update).mock.calls[0][0].data).not.toHaveProperty("botConfig");
    expect(vi.mocked(db.promptVersion.create).mock.calls[0][0].data).not.toHaveProperty("botSnapshot");
  });
});
