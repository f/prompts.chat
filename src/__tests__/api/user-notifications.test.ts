import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/user/notifications/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    changeRequest: {
      count: vi.fn(),
    },
    botTeamChangeRequest: {
      count: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    prompt: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/user/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.botTeamChangeRequest.count).mockResolvedValue(0);
  });

  it("should count pending change requests on the user's teams too", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.changeRequest.count).mockResolvedValue(2);
    vi.mocked(db.botTeamChangeRequest.count).mockResolvedValue(3);
    vi.mocked(db.notification.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const data = await (await GET()).json();

    expect(data.pendingChangeRequests).toBe(5);
    expect(db.botTeamChangeRequest.count).toHaveBeenCalledWith({
      where: { status: "PENDING", team: { authorId: "user1" } },
    });
  });

  it("should return default response if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      pendingChangeRequests: 0,
      unreadComments: 0,
      commentNotifications: [],
    });
  });

  it("should return default response if session has no user id", async () => {
    vi.mocked(auth).mockResolvedValue({ user: {} } as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pendingChangeRequests).toBe(0);
    expect(data.unreadComments).toBe(0);
  });

  it("should return notifications for authenticated user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.changeRequest.count).mockResolvedValue(3);
    vi.mocked(db.notification.findMany).mockResolvedValue([
      {
        id: "notif1",
        type: "COMMENT",
        createdAt: new Date(),
        promptId: "prompt1",
        actor: {
          id: "user2",
          name: "Commenter",
          username: "commenter",
          avatar: null,
        },
      },
    ] as never);
    vi.mocked(db.prompt.findMany).mockResolvedValue([
      { id: "prompt1", title: "Test Prompt" },
    ] as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pendingChangeRequests).toBe(3);
    expect(data.unreadComments).toBe(1);
    expect(data.commentNotifications).toHaveLength(1);
    expect(data.commentNotifications[0].promptTitle).toBe("Test Prompt");
  });

  it("should include actor info in notifications", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.changeRequest.count).mockResolvedValue(0);
    vi.mocked(db.notification.findMany).mockResolvedValue([
      {
        id: "notif1",
        type: "REPLY",
        createdAt: new Date(),
        promptId: "prompt1",
        actor: {
          id: "user2",
          name: "Reply User",
          username: "replyuser",
          avatar: "avatar.jpg",
        },
      },
    ] as never);
    vi.mocked(db.prompt.findMany).mockResolvedValue([
      { id: "prompt1", title: "My Prompt" },
    ] as never);

    const response = await GET();
    const data = await response.json();

    expect(data.commentNotifications[0].actor.name).toBe("Reply User");
    expect(data.commentNotifications[0].actor.avatar).toBe("avatar.jpg");
  });

  it("should return empty notifications array when none exist", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.changeRequest.count).mockResolvedValue(0);
    vi.mocked(db.notification.findMany).mockResolvedValue([]);
    vi.mocked(db.prompt.findMany).mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(data.commentNotifications).toEqual([]);
    expect(data.unreadComments).toBe(0);
  });
});

describe("POST /api/user/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/user/notifications", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should mark specific notifications as read", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 2 } as never);

    const request = new Request("http://localhost:3000/api/user/notifications", {
      method: "POST",
      body: JSON.stringify({ notificationIds: ["notif1", "notif2"] }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["notif1", "notif2"] },
        userId: "user1",
      },
      data: { read: true },
    });
  });

  it("should mark all notifications as read when no ids provided", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 5 } as never);

    const request = new Request("http://localhost:3000/api/user/notifications", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user1",
        read: false,
      },
      data: { read: true },
    });
  });

  it("should mark all notifications as read when notificationIds is not an array", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 3 } as never);

    const request = new Request("http://localhost:3000/api/user/notifications", {
      method: "POST",
      body: JSON.stringify({ notificationIds: "invalid" }),
    });
    const response = await POST(request);

    expect(db.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user1",
        read: false,
      },
      data: { read: true },
    });
  });
});
