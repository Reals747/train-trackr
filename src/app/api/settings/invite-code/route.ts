import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** Returns the store's permanent 8-digit join code. Kept under the legacy "invite-code"
 *  path so existing UI fetches continue to work after the trainer-invite refactor. */
export async function GET() {
  const { user, error } = await requireAuth({ permission: "members.invite" });
  if (error) return error;

  const store = await prisma.store.findUnique({
    where: { id: user.storeId },
    select: { storeCode: true },
  });

  return NextResponse.json({ storeCode: store?.storeCode ?? null });
}
