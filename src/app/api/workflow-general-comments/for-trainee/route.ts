import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * List workflow "general comments" for a trainee, one row per position that has non-empty text.
 * Used by the dashboard trainee modal (comments view).
 */
export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url);
  const traineeId = url.searchParams.get("traineeId");
  if (!traineeId) {
    return errorResponse("traineeId is required");
  }

  const trainee = await prisma.trainee.findFirst({
    where: { id: traineeId, storeId: user.storeId },
  });
  if (!trainee) return errorResponse("Trainee not found", 404);

  const rows = await prisma.workflowGeneralComments.findMany({
    where: { traineeId },
    include: { position: true },
  });

  const entries = rows
    .filter(
      (r) =>
        r.generalComments.trim().length > 0 &&
        r.position.storeId === user.storeId,
    )
    .map((r) => ({
      positionId: r.positionId,
      positionName: r.position.name,
      generalComments: r.generalComments.trim(),
    }))
    .sort((a, b) => a.positionName.localeCompare(b.positionName));

  return NextResponse.json({ entries });
}
