import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(2),
});

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const excludeHidden =
    searchParams.get("excludeHidden") === "1" ||
    searchParams.get("excludeHidden") === "true";

  /** Workflow checklist UI must never list hidden positions; Training Setup omits this param so managers still see all. */
  const includeHidden = can(user.role, "positions.manage") && !excludeHidden;

  const positions = await prisma.position.findMany({
    where: {
      storeId: user.storeId,
      ...(!includeHidden ? { hidden: false } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      items: { orderBy: { order: "asc" } },
    },
  });
  return NextResponse.json({ positions });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "positions.manage" });
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return errorResponse("Position name is required");

  try {
    const position = await prisma.position.create({
      data: { storeId: user.storeId, name: parsed.data.name.trim() },
    });
    await logActivity({
      storeId: user.storeId,
      userId: user.userId,
      message: `Created position ${position.name}`,
    });
    return NextResponse.json({ position });
  } catch {
    return errorResponse("Position name already exists", 409);
  }
}
