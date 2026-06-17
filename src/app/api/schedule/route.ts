import { NextResponse } from "next/server";
import { errorResponse, requireAuth } from "@/lib/api";
import { activeProfileFromRequest } from "@/lib/profile";
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
  const parsedDate = dateParam ? parseDateKey(dateParam) : new Date();
  if (dateParam && !parsedDate) {
    return errorResponse("Invalid date; use YYYY-MM-DD");
  }

  const dateKey = toDateKey(parsedDate ?? new Date());
  const activeProfile = profiles.find((profile) => profile.key === active);
  const payload = await loadScheduleDay(
    user.storeId,
    active,
    activeProfile?.name ?? active,
    dateKey,
  );
  return NextResponse.json(payload);
}
