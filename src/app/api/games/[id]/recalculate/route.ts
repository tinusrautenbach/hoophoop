import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { canManageGame } from "@/lib/auth-permissions";
import { recalculateGameTotals } from "@/services/game";

/**
 * POST /api/games/[id]/recalculate
 * Force full recalculation of game totals from events
 * 
 * @requires canManageGame() permission
 * @returns RecalculationResult with corrected status and details
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: gameId } = await context.params;

    // Check permission
    const allowed = await canManageGame(userId, gameId);
    if (!allowed) {
      return NextResponse.json(
        { error: "Forbidden - cannot manage this game" },
        { status: 403 }
      );
    }

    // Perform recalculation
    const result = await recalculateGameTotals(gameId, "manual");

    // Log if corrected
    if (result.corrected) {
      console.log(
        `[Recalculate API] Game ${gameId} corrected via manual trigger:`,
        { oldValues: result.oldValues, newValues: result.newValues }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Recalculate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
