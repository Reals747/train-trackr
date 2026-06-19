import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { isProfileColor, serializeStoreProfile } from "@/lib/store-profiles";
import { countProfileKeyUsage } from "@/lib/store-profiles-server";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(40).optional(),
    color: z.string().trim().optional(),
    scheduleLocationKeyword: z.string().trim().max(80).nullable().optional(),
    scheduleDepartmentKeyword: z.string().trim().max(80).nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.color !== undefined ||
      value.scheduleLocationKeyword !== undefined ||
      value.scheduleDepartmentKeyword !== undefined,
    { message: "Provide a field to update" },
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "settings.store.profiles" });
  if (error) return error;

  const { profileId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Invalid profile update");
  }

  const existing = await prisma.storeProfile.findFirst({
    where: { id: profileId, storeId: user.storeId },
  });
  if (!existing) return errorResponse("Profile not found", 404);

  const data: {
    name?: string;
    color?: string;
    scheduleLocationKeyword?: string | null;
    scheduleDepartmentKeyword?: string | null;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.color !== undefined) {
    if (!isProfileColor(parsed.data.color)) {
      return errorResponse("Invalid profile color");
    }
    data.color = parsed.data.color;
  }
  if (parsed.data.scheduleLocationKeyword !== undefined) {
    data.scheduleLocationKeyword = parsed.data.scheduleLocationKeyword?.trim() || null;
  }
  if (parsed.data.scheduleDepartmentKeyword !== undefined) {
    data.scheduleDepartmentKeyword = parsed.data.scheduleDepartmentKeyword?.trim() || null;
  }

  const updated = await prisma.storeProfile.update({
    where: { id: profileId },
    data,
  });

  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Updated profile "${updated.name}"`,
  });

  return NextResponse.json({ profile: serializeStoreProfile(updated) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { user, error } = await requireAuth({ permission: "settings.store.profiles" });
  if (error) return error;

  const { profileId } = await params;
  const existing = await prisma.storeProfile.findFirst({
    where: { id: profileId, storeId: user.storeId },
  });
  if (!existing) return errorResponse("Profile not found", 404);

  const profileCount = await prisma.storeProfile.count({ where: { storeId: user.storeId } });
  if (profileCount <= 1) {
    return errorResponse("At least one profile must remain for this store.", 400);
  }

  const usage = await countProfileKeyUsage(user.storeId, existing.key);
  if (usage > 0) {
    return errorResponse(
      "This profile is still in use by positions, trainees, tasks, or users. Reassign or remove that data first.",
      409,
    );
  }

  await prisma.storeProfile.delete({ where: { id: profileId } });
  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Deleted profile "${existing.name}"`,
  });
  return NextResponse.json({ success: true });
}
