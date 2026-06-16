import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { apiProfileField } from "@/lib/profile";
import { prisma } from "@/lib/prisma";
import {
  assertStoreProfileKey,
  listStoreProfiles,
  profileWriteData,
} from "@/lib/store-profiles-server";

const importSchema = z.object({
  positionIds: z.array(z.string().min(1)).min(1),
  targetProfile: z.string().trim().min(1).max(64),
});

export async function GET(request: Request) {
  const { user, error } = await requireAuth({ permission: "positions.manage" });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const targetProfile = searchParams.get("targetProfile")?.trim();
  if (!targetProfile) {
    return errorResponse("targetProfile is required");
  }

  const validatedTarget = await assertStoreProfileKey(user.storeId, targetProfile);
  if (!validatedTarget) {
    return errorResponse("Invalid target profile");
  }

  const profiles = await listStoreProfiles(user.storeId);
  const profileNameByKey = new Map(profiles.map((profile) => [profile.key, profile.name]));

  const [sources, existingOnTarget] = await Promise.all([
    prisma.position.findMany({
      where: {
        storeId: user.storeId,
        profileKey: { not: validatedTarget },
      },
      orderBy: [{ profileKey: "asc" }, { order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        profileKey: true,
        hidden: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.position.findMany({
      where: { storeId: user.storeId, profileKey: validatedTarget },
      select: { name: true },
    }),
  ]);

  const existingNames = new Set(existingOnTarget.map((row) => row.name));

  return NextResponse.json({
    positions: sources.map((position) => ({
      id: position.id,
      name: position.name,
      profileKey: position.profileKey,
      profileName: profileNameByKey.get(position.profileKey) ?? position.profileKey,
      hidden: position.hidden,
      itemCount: position._count.items,
      nameTakenOnTarget: existingNames.has(position.name),
    })),
  });
}

export async function POST(request: Request) {
  const { user, error } = await requireAuth({ permission: "positions.manage" });
  if (error) return error;

  const parsed = importSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse("Select at least one position to import");
  }

  const validatedTarget = await assertStoreProfileKey(user.storeId, parsed.data.targetProfile);
  if (!validatedTarget) {
    return errorResponse("Invalid target profile");
  }

  const uniqueIds = [...new Set(parsed.data.positionIds)];

  const sources = await prisma.position.findMany({
    where: {
      id: { in: uniqueIds },
      storeId: user.storeId,
      profileKey: { not: validatedTarget },
    },
    include: {
      items: { orderBy: { order: "asc" } },
    },
  });

  if (sources.length === 0) {
    return errorResponse("No valid positions selected for import");
  }

  const existingOnTarget = await prisma.position.findMany({
    where: { storeId: user.storeId, profileKey: validatedTarget },
    select: { name: true },
  });
  const existingNames = new Set(existingOnTarget.map((row) => row.name));

  const skipped: { name: string; reason: string }[] = [];
  const toImport = sources.filter((source) => {
    if (existingNames.has(source.name)) {
      skipped.push({ name: source.name, reason: "A position with this name already exists on the target profile" });
      return false;
    }
    existingNames.add(source.name);
    return true;
  });

  if (toImport.length === 0) {
    return errorResponse(
      skipped.length === 1
        ? skipped[0]!.reason
        : "All selected positions already exist on this profile",
    );
  }

  const profiles = await listStoreProfiles(user.storeId);
  const targetProfileName =
    profiles.find((profile) => profile.key === validatedTarget)?.name ?? validatedTarget;

  const created = await prisma.$transaction(async (tx) => {
    const maxOrder = await tx.position.aggregate({
      where: { storeId: user.storeId, profileKey: validatedTarget },
      _max: { order: true },
    });
    let nextOrder = (maxOrder._max.order ?? -1) + 1;
    const imported: Array<{ id: string; name: string; profile: string }> = [];

    for (const source of toImport) {
      const position = await tx.position.create({
        data: {
          storeId: user.storeId,
          name: source.name,
          hidden: source.hidden,
          order: nextOrder,
          ...profileWriteData(validatedTarget),
        },
      });
      nextOrder += 1;

      if (source.items.length > 0) {
        await tx.checklistItem.createMany({
          data: source.items.map((item) => ({
            positionId: position.id,
            text: item.text,
            description: item.description,
            order: item.order,
            kind: item.kind,
          })),
        });
      }

      imported.push({
        id: position.id,
        name: position.name,
        profile: apiProfileField(position),
      });
    }

    return imported;
  });

  await logActivity({
    storeId: user.storeId,
    userId: user.userId,
    message: `Imported ${created.length} position${created.length === 1 ? "" : "s"} into "${targetProfileName}"`,
  });

  return NextResponse.json({
    imported: created,
    skipped,
  });
}
