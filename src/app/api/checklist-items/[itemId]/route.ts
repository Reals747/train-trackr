import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  text: z.string().min(1),
  description: z.string().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "checklistItems.manage" });
  if (error) return error;
  const { itemId } = await params;

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { position: true },
  });
  if (!item || item.position.storeId !== user.storeId) {
    return errorResponse("Item not found", 404);
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid checklist item");

  const updated = await prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      text: parsed.data.text.trim(),
      description: parsed.data.description?.trim() || null,
    },
  });
  return NextResponse.json({ item: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "checklistItems.manage" });
  if (error) return error;
  const { itemId } = await params;

  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { position: true },
  });
  if (!item || item.position.storeId !== user.storeId) {
    return errorResponse("Item not found", 404);
  }

  await prisma.checklistItem.delete({ where: { id: itemId } });
  return NextResponse.json({ success: true });
}
