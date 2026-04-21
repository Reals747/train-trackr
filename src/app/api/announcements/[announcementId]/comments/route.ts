import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  body: z.string().min(1).max(4000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ announcementId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "announcements.comment" });
  if (error) return error;

  const { announcementId } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid comment");

  const announcement = await prisma.announcement.findFirst({
    where: { id: announcementId, storeId: user.storeId },
  });
  if (!announcement) return errorResponse("Announcement not found", 404);

  const comment = await prisma.announcementComment.create({
    data: {
      announcementId,
      userId: user.userId,
      body: parsed.data.body.trim(),
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    comment: {
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      userId: comment.user.id,
      userName: comment.user.name,
    },
  });
}
