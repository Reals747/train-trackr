import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
      { status: 400 },
    );
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true, passwordHash: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (dbUser.passwordHash) {
    return NextResponse.json(
      { error: "A password is already set for this account." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
