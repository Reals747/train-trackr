import { Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireAuth } from "@/lib/api";
import { activeProfileFromRequest, profileSchema } from "@/lib/profile";
import { prismaHasScheduleBreakCompletion } from "@/lib/prisma";
import { setScheduleBreakCompleted } from "@/lib/schedule-breaks-server";
import type { ScheduleBreakKey } from "@/lib/schedule-breaks-storage";
import { parseDateKey, toDateKey } from "@/lib/schedule";
import { assertStoreProfileKey, listStoreProfiles } from "@/lib/store-profiles-server";

const patchSchema = z.object({
  profile: profileSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employeeId: z.string().min(1).max(200),
  breakKey: z.enum(["break30Min", "break10MinFirst", "break10MinSecond"]),
  completed: z.boolean(),
});

function staleClientError() {
  return errorResponse(
    "Schedule break sync is unavailable until the database migration is applied. Run prisma migrate deploy and restart the server.",
    503,
  );
}

/** Persist a schedule break checkbox for the active store profile and day. */
export async function PATCH(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (user.role === Role.VIEWER) return errorResponse("Forbidden", 403);
  if (!prismaHasScheduleBreakCompletion()) return staleClientError();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid break payload");

  const date = parseDateKey(parsed.data.date);
  if (!date) return errorResponse("Invalid date; use YYYY-MM-DD");

  const profiles = await listStoreProfiles(user.storeId);
  const active = activeProfileFromRequest(request, parsed.data.profile, profiles.map((p) => p.key));
  const profileKey = await assertStoreProfileKey(user.storeId, active);
  if (!profileKey) return errorResponse("Select a valid profile");

  try {
    await setScheduleBreakCompleted(
      user.storeId,
      profileKey,
      toDateKey(date),
      parsed.data.employeeId,
      parsed.data.breakKey as ScheduleBreakKey,
      parsed.data.completed,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[schedule/breaks PATCH]", err);
    return errorResponse("Could not save break state", 500);
  }
}
