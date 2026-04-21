import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const announcements = await prisma.announcement.findMany({
    where: { storeId: user.storeId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true } },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      createdAt: a.createdAt.toISOString(),
      authorName: a.author.name,
      authorId: a.author.id,
      comments: a.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        userId: c.user.id,
        userName: c.user.name,
      })),
    })),
  });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "announcements.post" });
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Invalid announcement");

  const announcement = await prisma.announcement.create({
    data: {
      storeId: user.storeId,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      authorId: user.userId,
    },
  });

  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Posted announcement: ${announcement.title}`,
  });

  return NextResponse.json({
    announcement: {
      id: announcement.id,
      title: announcement.title,
      body: announcement.body,
      createdAt: announcement.createdAt.toISOString(),
      authorName: user.name,
      authorId: user.userId,
      comments: [],
    },
  });
}
