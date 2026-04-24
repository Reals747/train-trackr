import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-zA-Z0-9._-]+$/);

const schema = z.object({
  name: z.string().min(2),
  username: usernameSchema,
  password: z.string().min(8),
  role: z.enum(["TRAINER", "VIEWER"]),
});

export async function GET() {
  const { user, error } = await requireAuth({ permission: "members.view" });
  if (error) return error;

  const users = await prisma.user.findMany({
    where: { storeId: user.storeId },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "members.invite" });
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid user payload" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const created = await prisma.user.create({
    data: {
      name: parsed.data.name.trim(),
      username: parsed.data.username.toLowerCase(),
      passwordHash,
      role: parsed.data.role,
      storeId: user.storeId,
    },
    select: { id: true, name: true, username: true, role: true, createdAt: true },
  });
  return NextResponse.json({ user: created });
}
