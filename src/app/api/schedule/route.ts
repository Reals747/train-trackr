import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "@/lib/api";
import { activeProfileFromRequest } from "@/lib/profile";
import { toBusinessDateKey } from "@/lib/business-day";
import { parseDateKey, toDateKey } from "@/lib/schedule";
import { loadScheduleDay } from "@/lib/schedule-server";
import { listStoreProfiles } from "@/lib/store-profiles-server";

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;

  const profiles = await listStoreProfiles(user.storeId);
  const active = activeProfileFromRequest(request, user.activeProfile, profiles.map((p) => p.key));

  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const parsedDate = dateParam ? parseDateKey(dateParam) : null;
  if (dateParam && !parsedDate) {
    return errorResponse("Invalid date; use YYYY-MM-DD");
  }

  const dateKey = parsedDate ? toDateKey(parsedDate) : toBusinessDateKey();
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const activeProfile = profiles.find((profile) => profile.key === active);
  const payload = await loadScheduleDay(
    user.storeId,
    active,
    activeProfile?.name ?? active,
    dateKey,
    { forceRefresh },
  );
  return NextResponse.json(payload);
}
