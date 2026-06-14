import { Prisma } from "@prisma/client";
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
  text: z.string().trim().min(1).max(2000),
  profile: profileSchema.optional(),
});

const patchSchema = z.union([
  z.object({ id: z.string().min(1), text: z.string().trim().min(1).max(2000) }),
  z.object({ orderedIds: z.array(z.string().min(1)).max(1000) }),
]);

const deleteSchema = z.object({ id: z.string().min(1) });

/** List the store's preset bank (autocomplete + drag cards). Readable by everyone. */
export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (!prismaHasTaskRow()) return staleClientError();

  const profiles = await listStoreProfiles(user.storeId);
  const active = activeProfileFromRequest(request, user.activeProfile, profiles.map((p) => p.key));

  try {
    const presets = await prisma.taskPreset.findMany({
      where: { storeId: user.storeId, ...profileWhere(active) },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, text: true, order: true },
    });
    return NextResponse.json({ presets });
  } catch (e) {
    return handleTasksError("[tasks/presets GET]", e, "Could not load presets");
  }
}

/** Add a preset to the bank. */
export async function POST(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid preset payload");
  if (!prismaHasTaskRow()) return staleClientError();

  const profileKey = resolveWriteProfile(user.activeProfile, parsed.data.profile);
  if (!profileKey) return errorResponse("Select a valid profile for this preset");
  const validatedKey = await assertStoreProfileKey(user.storeId, profileKey);
  if (!validatedKey) return errorResponse("Select a valid profile for this preset");

  try {
    const existing = await prisma.taskPreset.findUnique({
      where: {
        storeId_profileKey_text: { storeId: user.storeId, profileKey: validatedKey, text: parsed.data.text },
      },
      select: { id: true, text: true, order: true },
    });
    if (existing) return NextResponse.json({ preset: existing });

    const max = await prisma.taskPreset.aggregate({
      where: { storeId: user.storeId, profileKey: validatedKey },
      _max: { order: true },
    });
    const preset = await prisma.taskPreset.create({
      data: {
        storeId: user.storeId,
        text: parsed.data.text,
        order: (max._max.order ?? -1) + 1,
        ...profileWriteData(validatedKey),
      },
      select: { id: true, text: true, order: true },
    });
    await logActivity({
      storeId: user.storeId,
      userId: user.userId,
      message: `Added task preset "${preset.text}"`,
    });
    return NextResponse.json({ preset });
  } catch (e) {
    return handleTasksError("[tasks/presets POST]", e, "Could not add preset");
  }
}

/** Rename a preset, or reorder the whole bank by id sequence. */
export async function PATCH(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid preset payload");
  if (!prismaHasTaskRow()) return staleClientError();

  try {
    if ("orderedIds" in parsed.data) {
      const profiles = await listStoreProfiles(user.storeId);
  const active = activeProfileFromRequest(request, user.activeProfile, profiles.map((p) => p.key));
      const owned = await prisma.taskPreset.findMany({
        where: { storeId: user.storeId, ...profileWhere(active), id: { in: parsed.data.orderedIds } },
        select: { id: true },
      });
      const ownedIds = new Set(owned.map((p) => p.id));
      await prisma.$transaction(
        parsed.data.orderedIds
          .filter((id) => ownedIds.has(id))
          .map((id, index) =>
            prisma.taskPreset.update({ where: { id }, data: { order: index } }),
          ),
      );
      await logActivity({
        storeId: user.storeId,
        userId: user.userId,
        message: "Reordered task presets",
      });
      return NextResponse.json({ ok: true });
    }

    const existing = await prisma.taskPreset.findUnique({
      where: { id: parsed.data.id },
      select: { storeId: true },
    });
    if (existing?.storeId !== user.storeId) return errorResponse("Preset not found", 404);

    const preset = await prisma.taskPreset.update({
      where: { id: parsed.data.id },
      data: { text: parsed.data.text },
      select: { id: true, text: true, order: true },
    });
    await logActivity({
      storeId: user.storeId,
      userId: user.userId,
      message: `Renamed task preset to ${preset.text}`,
    });
    return NextResponse.json({ preset });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return errorResponse("That task is already in the bank", 409);
    }
    return handleTasksError("[tasks/presets PATCH]", e, "Could not update preset");
  }
}

/** Remove a preset from the bank. */
export async function DELETE(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid preset payload");
  if (!prismaHasTaskRow()) return staleClientError();

  try {
    const existing = await prisma.taskPreset.findUnique({
      where: { id: parsed.data.id },
      select: { storeId: true, text: true },
    });
    if (existing?.storeId !== user.storeId) return errorResponse("Preset not found", 404);

    await prisma.taskPreset.delete({ where: { id: parsed.data.id } });
    await logActivity({
      storeId: user.storeId,
      userId: user.userId,
      message: `Deleted task preset "${existing.text}"`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleTasksError("[tasks/presets DELETE]", e, "Could not delete preset");
  }
}
