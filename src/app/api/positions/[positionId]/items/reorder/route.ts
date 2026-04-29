import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/**
 * Bulk reorder checklist items (and section headers) within a position.
 *
 * Body: { orderedIds: string[] } — full list of item IDs in the desired order.
 * All IDs must belong to the given position; mismatched lists are rejected so
 * we never accidentally reparent items to a different position.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ positionId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "checklistItems.manage" });
  if (error) return error;
  const { positionId } = await params;

  const position = await prisma.position.findFirst({
    where: { id: positionId, storeId: user.storeId },
    select: { id: true },
  });
  if (!position) return errorResponse("Position not found", 404);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid payload");

  const { orderedIds } = parsed.data;

  const existing = await prisma.checklistItem.findMany({
    where: { positionId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    return errorResponse("One or more items are missing or not in this position", 400);
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.checklistItem.update({
        where: { id },
        data: { order: index },
      }),
    ),
  );

  return NextResponse.json({ success: true });
}
