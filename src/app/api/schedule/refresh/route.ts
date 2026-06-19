import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { toBusinessDateKey } from "@/lib/business-day";
import { activeProfileFromRequest, profileSchema } from "@/lib/profile";
import { parseDateKey, toDateKey } from "@/lib/schedule";
import { loadScheduleDay } from "@/lib/schedule-server";
import { listStoreProfiles } from "@/lib/store-profiles-server";

const bodySchema = z.object({
  profile: profileSchema.optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Force-refresh the cached roster from Fourth Schedules. */
export async function POST(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid refresh payload");

  const profiles = await listStoreProfiles(user.storeId);
  const active = activeProfileFromRequest(
    request,
    parsed.data.profile ?? user.activeProfile,
    profiles.map((p) => p.key),
  );

  let dateKey: string | null = toBusinessDateKey();
  if (parsed.data.date) {
    const parsedDate = parseDateKey(parsed.data.date);
    if (!parsedDate) return errorResponse("Invalid date; use YYYY-MM-DD");
    dateKey = toDateKey(parsedDate);
  }

  const activeProfile = profiles.find((profile) => profile.key === active);
  const payload = await loadScheduleDay(
    user.storeId,
    active,
    activeProfile?.name ?? active,
    dateKey,
    { forceRefresh: true },
  );

  return NextResponse.json(payload);
}
