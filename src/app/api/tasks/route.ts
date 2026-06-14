import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth, STORE_MANAGER_ROLES } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma, prismaHasTaskRow } from "@/lib/prisma";
import { TASK_COLUMN_COUNT, setTaskDone } from "@/lib/tasks";
import { handleTasksError, staleClientError } from "@/lib/tasks-api";
import { activeProfileFromRequest, apiProfileField } from "@/lib/profile";
import { addPresetsFromContent, loadGrid, rowBelongsToStore } from "@/lib/tasks-server";
import { listStoreProfiles } from "@/lib/store-profiles-server";

const putSchema = z.object({
  rowId: z.string().min(1),
  colIndex: z.number().int().min(0).max(TASK_COLUMN_COUNT - 1),
  content: z.string().max(20000),
});

const patchSchema = z.object({
  rowId: z.string().min(1),
  colIndex: z.number().int().min(0).max(TASK_COLUMN_COUNT - 1),
  lineIndex: z.number().int().min(0).max(999),
  done: z.boolean(),
});

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (!prismaHasTaskRow()) return staleClientError();

  const profiles = await listStoreProfiles(user.storeId);
  const active = activeProfileFromRequest(request, user.activeProfile, profiles.map((p) => p.key));

  try {
    const rows = await loadGrid(user.storeId, active);
    return NextResponse.json({ rows });
  } catch (e) {
    return handleTasksError("[tasks GET]", e, "Could not load tasks");
  }
}

export async function PUT(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid tasks payload");
  if (!prismaHasTaskRow()) return staleClientError();

  const { rowId, colIndex, content } = parsed.data;

  try {
    const row = await prisma.taskRow.findUnique({
      where: { id: rowId },
      select: { storeId: true, profileKey: true, profile: true },
    });
    if (!row || row.storeId !== user.storeId) {
      return errorResponse("Row not found", 404);
    }

    const cell = await prisma.taskCell.upsert({
      where: { rowId_colIndex: { rowId, colIndex } },
      create: { rowId, colIndex, content },
      update: { content },
      select: { rowId: true, colIndex: true, content: true },
    });
    await addPresetsFromContent(user.storeId, content, apiProfileField(row));
    await logActivity({
      storeId: user.storeId,
      userId: user.userId,
      message: "Updated tasks grid",
    });
    return NextResponse.json({ cell });
  } catch (e) {
    return handleTasksError("[tasks PUT]", e, "Could not save task");
  }
}

/**
 * Toggle a single task's checkbox. Allowed for any authenticated user in the store (checking
 * tasks off is everyday staff work, unlike editing task text which stays gated to managers via
 * PUT). Only flips the line's done marker, so it can't inject or overwrite task text.
 */
export async function PATCH(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid tasks payload");
  if (!prismaHasTaskRow()) return staleClientError();

  const { rowId, colIndex, lineIndex, done } = parsed.data;

  try {
    if (!(await rowBelongsToStore(rowId, user.storeId))) {
      return errorResponse("Row not found", 404);
    }

    const existing = await prisma.taskCell.findUnique({
      where: { rowId_colIndex: { rowId, colIndex } },
      select: { content: true },
    });
    const nextContent = setTaskDone(existing?.content ?? "", lineIndex, done);

    const cell = await prisma.taskCell.upsert({
      where: { rowId_colIndex: { rowId, colIndex } },
      create: { rowId, colIndex, content: nextContent },
      update: { content: nextContent },
      select: { rowId: true, colIndex: true, content: true },
    });
    return NextResponse.json({ cell });
  } catch (e) {
    return handleTasksError("[tasks PATCH]", e, "Could not update task");
  }
}
