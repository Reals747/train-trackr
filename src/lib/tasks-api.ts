import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";

/** Shared error handling for the Tasks API routes (grid, rows, presets, weeks). */

export function tasksTableMissingMessage(): string {
  return "Tasks storage is not set up on this database yet. From the training-tracker folder, run: npx prisma migrate deploy (use the same DATABASE_URL the app uses).";
}

export function isMissingTaskTable(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2021") return true;
  const meta = e.meta as { table?: string; modelName?: string } | undefined;
  const tableRef = [meta?.table, meta?.modelName].filter(Boolean).join(" ");
  if (/Task(Cell|Row|Preset|WeekArchive)/.test(tableRef)) return true;
  return /Task(Cell|Row)/.test(e.message) && e.message.includes("does not exist");
}

export function jsonError(message: string, status: number, prismaCode?: string) {
  return NextResponse.json({ error: message, ...(prismaCode ? { prismaCode } : {}) }, { status });
}

export function staleClientError() {
  return jsonError(
    "Prisma client is out of date. Run: npx prisma generate — then restart next dev (or redeploy).",
    503,
    "PRISMA_CLIENT_STALE",
  );
}

/** Map common Prisma failures to the shared response shape. */
export function handleTasksError(tag: string, e: unknown, fallback: string) {
  if (isMissingTaskTable(e)) return jsonError(tasksTableMissingMessage(), 503, "P2021");
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(tag, e.code, e.message);
    return jsonError(fallback, 500, e.code);
  }
  if (e instanceof Prisma.PrismaClientInitializationError) {
    console.error(tag, e.message);
    return jsonError("Could not connect to the database from the server.", 503, e.errorCode);
  }
  console.error(tag, e);
  return errorResponse(fallback, 500);
}
