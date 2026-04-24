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
    account: {
      id: dbUser.id,
      name: dbUser.name,
      username: dbUser.username,
      role: dbUser.role,
      createdAt: dbUser.createdAt,
      storeName: dbUser.store.name,
      storeId: dbUser.storeId,
      storeCode: dbUser.store.storeCode,
    },
  });
}
