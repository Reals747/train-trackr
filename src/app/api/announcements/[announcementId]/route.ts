import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ announcementId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "announcements.delete" });
  if (error) return error;

  const { announcementId } = await params;
  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, storeId: user.storeId },
  });
  if (!announcement) return errorResponse("Announcement not found", 404);

  await prisma.announcement.delete({ where: { id: announcementId } });
  return NextResponse.json({ success: true });
}
