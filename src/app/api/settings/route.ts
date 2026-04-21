import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  trainerCanViewAll: z.boolean(),
  darkModeEnabled: z.boolean(),
});

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const settings = await prisma.storeSetting.findUnique({
    where: { storeId: user.storeId },
  });
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const { user, error } = await requireAuth({ permission: "settings.store.view" });
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
  }

  const settings = await prisma.storeSetting.upsert({
    where: { storeId: user.storeId },
    create: {
      storeId: user.storeId,
      trainerCanViewAll: parsed.data.trainerCanViewAll,
      darkModeEnabled: parsed.data.darkModeEnabled,
    },
    update: {
      trainerCanViewAll: parsed.data.trainerCanViewAll,
      darkModeEnabled: parsed.data.darkModeEnabled,
    },
  });

  return NextResponse.json({ settings });
}
