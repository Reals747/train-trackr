import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth, STORE_MANAGER_ROLES } from "@/lib/api";
import { prisma, prismaHasTaskCell } from "@/lib/prisma";

const putSchema = z.object({
  rowIndex: z.number().int().min(0).max(999),
  colIndex: z.number().int().min(0).max(999),
  content: z.string().max(20000),
});

function tasksTableMissingMessage(): string {
  return "Tasks storage is not set up on this database yet. From the training-tracker folder, run: npx prisma migrate deploy (use the same DATABASE_URL the app uses).";
}

function isMissingTaskCellTable(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  const meta = e.meta as { table?: string; modelName?: string } | undefined;
  const tableRef = [meta?.table, meta?.modelName].filter(Boolean).join(" ");
  if (tableRef.includes("TaskCell")) return true;
  return e.message.includes("TaskCell") && e.message.includes("does not exist");
}

function jsonError(message: string, status: number, prismaCode?: string) {
  return NextResponse.json({ error: message, ...(prismaCode ? { prismaCode } : {}) }, { status });
}

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  if (!prismaHasTaskCell()) {
    return jsonError(
      "Prisma client is out of date. Run: npx prisma generate — then restart next dev (or redeploy).",
      503,
      "PRISMA_CLIENT_STALE",
    );
  }

  try {
    const cells = await prisma.taskCell.findMany({
      where: { storeId: user.storeId },
      select: { rowIndex: true, colIndex: true, content: true },
    });
    return NextResponse.json({ cells });
  } catch (e) {
    if (isMissingTaskCellTable(e)) {
      return jsonError(tasksTableMissingMessage(), 503, "P2021");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[tasks GET]", e.code, e.message);
      return jsonError("Could not load tasks", 500, e.code);
    }
    if (e instanceof Prisma.PrismaClientInitializationError) {
      console.error("[tasks GET]", e.message);
      return jsonError("Could not connect to the database from the server.", 503, e.errorCode);
    }
    console.error("[tasks GET]", e);
    return errorResponse("Could not load tasks", 500);
  }
}

export async function PUT(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid tasks payload");

  if (!prismaHasTaskCell()) {
    return jsonError(
      "Prisma client is out of date. Run: npx prisma generate — then restart next dev (or redeploy).",
      503,
      "PRISMA_CLIENT_STALE",
    );
  }

  const { rowIndex, colIndex, content } = parsed.data;

  try {
    const row = await prisma.taskCell.upsert({
      where: {
        storeId_rowIndex_colIndex: { storeId: user.storeId, rowIndex, colIndex },
      },
      create: { storeId: user.storeId, rowIndex, colIndex, content },
      update: { content },
      select: { rowIndex: true, colIndex: true, content: true },
    });
    return NextResponse.json({ cell: row });
  } catch (e) {
    if (isMissingTaskCellTable(e)) {
      return jsonError(tasksTableMissingMessage(), 503, "P2021");
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("[tasks PUT]", e.code, e.message);
      return jsonError("Could not save task", 500, e.code);
    }
    if (e instanceof Prisma.PrismaClientInitializationError) {
      console.error("[tasks PUT]", e.message);
      return jsonError("Could not connect to the database from the server.", 503, e.errorCode);
    }
    console.error("[tasks PUT]", e);
    return errorResponse("Could not save task", 500);
  }
}
