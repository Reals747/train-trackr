import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

/**
 * Bulk reorder positions for the current store.
 *
 * Body: { orderedIds: string[] } — full list of position IDs in the desired order.
 * The handler verifies every ID belongs to the caller's store and rejects the
 * request if any ID is missing or foreign so a single bad request can't shuffle
 * unrelated stores.
 */
export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "positions.manage" });
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid payload");

  const { orderedIds } = parsed.data;

  const existing = await prisma.position.findMany({
    where: { storeId: user.storeId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    return errorResponse("One or more positions are missing or not in this store", 400);
  }

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.position.update({
        where: { id },
        data: { order: index },
      }),
    ),
  );

  return NextResponse.json({ success: true });
}
