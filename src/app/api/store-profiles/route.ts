import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
import { listStoreProfiles } from "@/lib/store-profiles-server";

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const profiles = await listStoreProfiles(user.storeId);
  return NextResponse.json({ profiles });
}
