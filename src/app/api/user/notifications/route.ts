import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { countPendingTeamChangeRequests } from "@/lib/bots/team-changes";

const DEFAULT_RESPONSE = { 
  pendingChangeRequests: 0,
  unreadComments: 0,
  commentNotifications: [],
};

export async function GET() {
  let session;
  try {
    session = await auth();
  } catch (error) {
    console.error("Auth error in notifications:", error);
    return NextResponse.json(DEFAULT_RESPONSE);
  }

  if (!session?.user?.id) {
    return NextResponse.json(DEFAULT_RESPONSE);
  }

  try {
    // Count pending change requests on user's prompts
    const [promptPendingCount, teamPendingCount] = await Promise.all([
      db.changeRequest.count({
        where: {
          status: "PENDING",
          prompt: {
            authorId: session.user.id,
          },
        },
      }),
      countPendingTeamChangeRequests(session.user.id),
    ]);
    const pendingCount = promptPendingCount + teamPendingCount;

    // Get unread comment notifications
    const commentNotifications = await db.notification.findMany({
      where: {
        userId: session.user.id,
        read: false,
        type: { in: ["COMMENT", "REPLY"] },
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get prompt titles for notifications
    const promptIds = [...new Set(commentNotifications.map(n => n.promptId).filter(Boolean))] as string[];
    const prompts = await db.prompt.findMany({
      where: { id: { in: promptIds } },
      select: { id: true, title: true },
    });
    const promptMap = new Map(prompts.map(p => [p.id, p.title]));

    const formattedNotifications = commentNotifications.map(n => ({
      id: n.id,
      type: n.type,
      createdAt: n.createdAt,
      actor: n.actor,
      promptId: n.promptId,
      promptTitle: n.promptId ? promptMap.get(n.promptId) : null,
    }));

    return NextResponse.json({ 
      pendingChangeRequests: pendingCount,
      unreadComments: commentNotifications.length,
      commentNotifications: formattedNotifications,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return NextResponse.json(DEFAULT_RESPONSE);
  }

  // Fallback return (should never reach here)
  return NextResponse.json(DEFAULT_RESPONSE);
}

// POST - Mark notifications as read
export async function POST(request: Request) {
  let session;
  try {
    session = await auth();
  } catch (error) {
    console.error("Auth error in notifications:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { notificationIds } = body;

    if (notificationIds && Array.isArray(notificationIds)) {
      // Mark specific notifications as read
      await db.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: session.user.id,
        },
        data: { read: true },
      });
    } else {
      // Mark all notifications as read
      await db.notification.updateMany({
        where: {
          userId: session.user.id,
          read: false,
        },
        data: { read: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  // Fallback return (should never reach here)
  return NextResponse.json({ success: true });
}
