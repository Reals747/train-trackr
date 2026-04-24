import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    include: { store: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      name: dbUser.name,
      storeId: dbUser.storeId,
      storeName: dbUser.store.name,
      storeCode: dbUser.store.storeCode,
    },
  });
}
