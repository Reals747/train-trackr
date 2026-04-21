import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
});

export async function GET() {
  const { user, error } = await requireAuth({ permission: "settings.store.view" });
  if (error) return error;

  const store = await prisma.store.findUnique({
    where: { id: user.storeId },
    include: {
      settings: true,
      _count: {
        select: {
          users: true,
          positions: true,
          trainees: true,
        },
      },
    },
  });
  if (!store) {
    return errorResponse("Store not found", 404);
  }

  return NextResponse.json({ store });
}

export async function PUT(request: Request) {
  const { user, error } = await requireAuth({ permission: "settings.store.rename" });
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse("Invalid store name");
  }

  const store = await prisma.store.update({
    where: { id: user.storeId },
    data: { name: parsed.data.name.trim() },
  });

  return NextResponse.json({ store });
}

export async function DELETE() {
  const { user, error } = await requireAuth({ permission: "settings.store.delete" });
  if (error) return error;

  await prisma.store.delete({ where: { id: user.storeId } });
  return NextResponse.json({ success: true });
}
