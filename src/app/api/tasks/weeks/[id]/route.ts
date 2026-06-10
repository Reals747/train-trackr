import { NextResponse } from "next/server";
import { requireAuth, STORE_MANAGER_ROLES } from "@/lib/api";
import { prisma, prismaHasTaskRow } from "@/lib/prisma";
import { handleTasksError, jsonError, staleClientError } from "@/lib/tasks-api";
import type { WeekArchiveData } from "@/lib/tasks";

/** Fetch one archived week's full grid snapshot (read-only). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (!prismaHasTaskRow()) return staleClientError();

  const { id } = await params;

  try {
    const week = await prisma.taskWeekArchive.findUnique({
      where: { id },
      select: { id: true, label: true, archivedAt: true, data: true, storeId: true },
    });
    if (!week || week.storeId !== user.storeId) {
      return jsonError("Week not found", 404);
    }
    const { storeId: _omit, ...rest } = week;
    void _omit;
    return NextResponse.json({ week: rest });
  } catch (e) {
    return handleTasksError("[tasks/weeks/:id GET]", e, "Could not load week");
  }
}

/**
 * Revert the live grid to this archived week: rebuild rows and cells from the snapshot. This
 * overwrites the current week, so the UI warns the manager to start a new week first (which
 * archives the current one) — keeping data recoverable. The archive itself is left untouched.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;
  if (!prismaHasTaskRow()) return staleClientError();

  const { id } = await params;

  try {
    const archive = await prisma.taskWeekArchive.findUnique({
      where: { id },
      select: { storeId: true, profile: true, data: true },
    });
    if (!archive || archive.storeId !== user.storeId) return jsonError("Week not found", 404);

    const data = archive.data as unknown as WeekArchiveData;
    const rows = Array.isArray(data?.rows) ? data.rows : [];

    // Restore into the archive's own profile only, so reverting an FOH week never touches BOH
    // rows (and vice versa). The two profiles keep entirely separate grids and archives.
    await prisma.$transaction(async (tx) => {
      await tx.taskRow.deleteMany({
        where: { storeId: user.storeId, profile: archive.profile },
      });
      for (let i = 0; i < rows.length; i++) {
        const snapshotRow = rows[i];
        const created = await tx.taskRow.create({
          data: {
            storeId: user.storeId,
            profile: archive.profile,
            label: snapshotRow.label ?? "",
            order: i,
          },
          select: { id: true },
        });
        const cells = Object.entries(snapshotRow.cells ?? {})
          .filter(([, content]) => typeof content === "string" && content.length > 0)
          .map(([colIndex, content]) => ({
            rowId: created.id,
            colIndex: Number(colIndex),
            content: content as string,
          }));
        if (cells.length > 0) await tx.taskCell.createMany({ data: cells });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleTasksError("[tasks/weeks/:id POST]", e, "Could not revert to week");
  }
}

/** Permanently delete an archived week. Manager-only; not recoverable. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;
  if (!prismaHasTaskRow()) return staleClientError();

  const { id } = await params;

  try {
    const archive = await prisma.taskWeekArchive.findUnique({
      where: { id },
      select: { storeId: true },
    });
    if (!archive || archive.storeId !== user.storeId) return jsonError("Week not found", 404);

    await prisma.taskWeekArchive.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleTasksError("[tasks/weeks/:id DELETE]", e, "Could not delete week");
  }
}
