import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const appearanceSchema = z.object({
  darkMode: z.boolean(),
  fontScale: z.number().min(0.85).max(1.35),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  compactCards: z.boolean(),
  followSystemTheme: z.boolean(),
});

const BASE_DEFAULTS = {
  darkMode: false,
  fontScale: 1,
  accent: "#dc2626",
  compactCards: false,
  followSystemTheme: true,
} as const;

function mergeAppearance(raw: unknown) {
  if (!raw || typeof raw !== "object") return { ...BASE_DEFAULTS };
  return { ...BASE_DEFAULTS, ...(raw as Record<string, unknown>) };
}

export async function GET() {
  const { user, error } = await requireAuth({ permission: "settings.appearance" });
  if (error) return error;

  const row = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { appearanceJson: true },
  });
  const parsed = appearanceSchema.safeParse(mergeAppearance(row?.appearanceJson));
  if (parsed.success) {
    return NextResponse.json({ appearance: parsed.data });
  }

  return NextResponse.json({ appearance: { ...BASE_DEFAULTS } });
}

export async function PUT(request: Request) {
  const { user, error } = await requireAuth({ permission: "settings.appearance" });
  if (error) return error;

  const raw = await request.json().catch(() => null);
  const parsed = appearanceSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse("Invalid appearance payload");
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { appearanceJson: parsed.data },
  });

  return NextResponse.json({ appearance: parsed.data });
}
