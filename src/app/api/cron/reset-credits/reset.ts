import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Resets every user's generation credits to their daily limit */
export async function resetCredits(): Promise<NextResponse> {
  try {
    const result = await db.$executeRaw`
      UPDATE users 
      SET "generationCreditsRemaining" = "dailyGenerationLimit",
          "generationCreditsResetAt" = NOW()
    `;

    console.log(`Daily credit reset completed. Updated ${result} users.`);

    return NextResponse.json({
      success: true,
      message: "Daily generation credits reset successfully",
      usersUpdated: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error resetting daily credits:", error);
    return NextResponse.json(
      { error: "Failed to reset credits" },
      { status: 500 }
    );
  }
}
