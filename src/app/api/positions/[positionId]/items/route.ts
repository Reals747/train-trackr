import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  text: z.string().min(1),
  description: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ positionId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "checklistItems.manage" });
  if (error) return error;
  const { positionId } = await params;

  const position = await prisma.position.findFirst({
    where: { id: positionId, storeId: user.storeId },
  });
  if (!position) return errorResponse("Position not found", 404);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Checklist item text is required");

  const maxOrder = await prisma.checklistItem.aggregate({
    where: { positionId },
    _max: { order: true },
  });
  const item = await prisma.checklistItem.create({
    data: {
      positionId,
      text: parsed.data.text.trim(),
      description: parsed.data.description?.trim() || null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Added checklist item to ${position.name}`,
  });

  return NextResponse.json({ item });
}
