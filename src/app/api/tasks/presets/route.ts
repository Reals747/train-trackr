import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth, STORE_MANAGER_ROLES } from "@/lib/api";
import {
  activeProfileFromRequest,
  profileSchema,
  profileWhere,
  resolveWriteProfile,
} from "@/lib/profile";
import { prisma, prismaHasTaskRow } from "@/lib/prisma";
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

  const active = activeProfileFromRequest(request, user.activeProfile);

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

  const profile = resolveWriteProfile(user.activeProfile, parsed.data.profile);
  if (!profile) return errorResponse("Select FOH or BOH profile for this preset");

  try {
    const existing = await prisma.taskPreset.findUnique({
      where: {
        storeId_profile_text: { storeId: user.storeId, profile, text: parsed.data.text },
      },
      select: { id: true, text: true, order: true },
    });
    if (existing) return NextResponse.json({ preset: existing });

    const max = await prisma.taskPreset.aggregate({
      where: { storeId: user.storeId, profile },
      _max: { order: true },
    });
    const preset = await prisma.taskPreset.create({
      data: {
        storeId: user.storeId,
        profile,
        text: parsed.data.text,
        order: (max._max.order ?? -1) + 1,
      },
      select: { id: true, text: true, order: true },
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
      const active = activeProfileFromRequest(request, user.activeProfile);
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
      select: { storeId: true },
    });
    if (existing?.storeId !== user.storeId) return errorResponse("Preset not found", 404);

    await prisma.taskPreset.delete({ where: { id: parsed.data.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleTasksError("[tasks/presets DELETE]", e, "Could not delete preset");
  }
}
