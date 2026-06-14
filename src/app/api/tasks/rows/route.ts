import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth, STORE_MANAGER_ROLES } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import {
  activeProfileFromRequest,
  profileSchema,
  profileWhere,
  resolveWriteProfile,
} from "@/lib/profile";
import { prisma, prismaHasTaskRow } from "@/lib/prisma";
import { assertStoreProfileKey, listStoreProfiles, profileWriteData } from "@/lib/store-profiles-server";
import { handleTasksError, staleClientError } from "@/lib/tasks-api";

const postSchema = z.object({
  label: z.string().max(120).optional(),
  profile: profileSchema.optional(),
});

const patchSchema = z.union([
  z.object({ id: z.string().min(1), label: z.string().max(120) }),
  z.object({ orderedIds: z.array(z.string().min(1)).max(200) }),
]);

const deleteSchema = z.object({ id: z.string().min(1) });

/** Add an employee row at the end of the grid. */
export async function POST(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid row payload");
  if (!prismaHasTaskRow()) return staleClientError();

  const profileKey = resolveWriteProfile(user.activeProfile, parsed.data.profile);
  if (!profileKey) return errorResponse("Select a valid profile for this row");
  const validatedKey = await assertStoreProfileKey(user.storeId, profileKey);
  if (!validatedKey) return errorResponse("Select a valid profile for this row");

  try {
    const max = await prisma.taskRow.aggregate({
      where: { storeId: user.storeId, profileKey: validatedKey },
      _max: { order: true },
    });
    const row = await prisma.taskRow.create({
      data: {
        storeId: user.storeId,
        label: parsed.data.label ?? "",
        order: (max._max.order ?? -1) + 1,
        ...profileWriteData(validatedKey),
      },
      select: { id: true, label: true, order: true },
    });
    await logActivity({
      storeId: user.storeId,
      userId: user.userId,
      message: `Added task row "${row.label || "Untitled"}"`,
    });
    return NextResponse.json({ row });
  } catch (e) {
    return handleTasksError("[tasks/rows POST]", e, "Could not add row");
  }
}

/** Rename a row, or reorder all rows by a provided id sequence. */
export async function PATCH(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid row payload");
  if (!prismaHasTaskRow()) return staleClientError();

  try {
    if ("orderedIds" in parsed.data) {
      const profiles = await listStoreProfiles(user.storeId);
      const active = activeProfileFromRequest(request, user.activeProfile, profiles.map((p) => p.key));
      const owned = await prisma.taskRow.findMany({
        where: { storeId: user.storeId, ...profileWhere(active), id: { in: parsed.data.orderedIds } },
        select: { id: true },
      });
      const ownedIds = new Set(owned.map((r) => r.id));
      await prisma.$transaction(
        parsed.data.orderedIds
          .filter((id) => ownedIds.has(id))
          .map((id, index) =>
            prisma.taskRow.update({ where: { id }, data: { order: index } }),
          ),
      );
      await logActivity({
        storeId: user.storeId,
        userId: user.userId,
        message: "Reordered task rows",
      });
      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.taskRow.findUnique({
      where: { id: parsed.data.id },
      select: { storeId: true },
    });
    if (existing?.storeId !== user.storeId) return errorResponse("Row not found", 404);

    const row = await prisma.taskRow.update({
      where: { id: parsed.data.id },
      data: { label: parsed.data.label },
      select: { id: true, label: true, order: true },
    });
    await logActivity({
      storeId: user.storeId,
      userId: user.userId,
      message: `Renamed task row to ${row.label}`,
    });
    return NextResponse.json({ row });
  } catch (e) {
    return handleTasksError("[tasks/rows PATCH]", e, "Could not update row");
  }
}

/** Remove a row and its cells (cascade). */
export async function DELETE(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid row payload");
  if (!prismaHasTaskRow()) return staleClientError();

  try {
    const existing = await prisma.taskRow.findUnique({
      where: { id: parsed.data.id },
      select: { storeId: true, label: true },
    });
    if (existing?.storeId !== user.storeId) return errorResponse("Row not found", 404);

    await prisma.taskRow.delete({ where: { id: parsed.data.id } });
    await logActivity({
      storeId: user.storeId,
      userId: user.userId,
      message: `Deleted task row "${existing.label || "Untitled"}"`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleTasksError("[tasks/rows DELETE]", e, "Could not delete row");
  }
}
