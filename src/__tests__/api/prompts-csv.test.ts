import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/prompts.csv/route";
import { buildContributorField } from "@/lib/prompts-csv";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    prompt: {
      findMany: vi.fn(),
    },
  },
}));

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function user(username: string, githubUsername: string | null = null) {
  return { username, githubUsername };
}

describe("buildContributorField", () => {
  it("prefers the GitHub handle and falls back to the prompts.chat username", () => {
    expect(buildContributorField(user("alice", "alice-gh"), [user("bob")])).toBe("alice-gh,bob");
  });

  it("dedupes, excludes the author and sorts co-contributors deterministically", () => {
    const contributors = [user("zed"), user("amy"), user("zed"), user("alice", "alice-gh")];
    const field = buildContributorField(user("alice", "alice-gh"), contributors);
    expect(field).toBe("alice-gh,amy,zed");
    expect(buildContributorField(user("alice", "alice-gh"), [...contributors].reverse())).toBe(field);
  });
});

describe("GET /prompts.csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("never selects or emits email addresses", async () => {
    vi.mocked(db.prompt.findMany).mockResolvedValue([
      {
        title: "Linux Terminal",
        content: "Act as a terminal",
        structuredFormat: null,
        category: { slug: "coding" },
        author: user("googleuser"),
        contributors: [user("unclaimed_one"), user("ghuser", "GhUser")],
      },
    ] as never);

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toBe(
      'act,prompt,for_devs,type,contributor\nLinux Terminal,Act as a terminal,TRUE,TEXT,"googleuser,GhUser,unclaimed_one"'
    );
    expect(body).not.toMatch(EMAIL_RE);

    const args = vi.mocked(db.prompt.findMany).mock.calls[0][0] as {
      select: { author: { select: Record<string, boolean> }; contributors: { select: Record<string, boolean> } };
    };
    expect(args.select.author.select).not.toHaveProperty("email");
    expect(args.select.contributors.select).not.toHaveProperty("email");
  });
});
