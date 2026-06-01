import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { format } from "date-fns";
import { errorResponse, requireAuth, STORE_MANAGER_ROLES } from "@/lib/api";
import { prisma, prismaHasTaskRow } from "@/lib/prisma";
import { handleTasksError, staleClientError } from "@/lib/tasks-api";
import { buildArchiveData } from "@/lib/tasks-server";

const postSchema = z.object({ label: z.string().max(160).optional() });

function defaultLabel(): string {
  return `Week of ${format(new Date(), "MMM d, yyyy")}`;
}

/**
 * Make a label unique within the store by appending " (1)", " (2)", … to collisions, so
 * multiple weeks archived on the same day are distinguishable (e.g. "Week of May 31, 2026",
 * "Week of May 31, 2026 (1)").
 */
async function uniqueLabel(storeId: string, base: string): Promise<string> {
  const existing = await prisma.taskWeekArchive.findMany({
    where: { storeId, label: { startsWith: base } },
    select: { label: true },
  });
  const taken = new Set(existing.map((w) => w.label));
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

/** List archived weeks (most recent first). Summaries only — fetch one for its grid. */
export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;
  if (!prismaHasTaskRow()) return staleClientError();

  try {
    const weeks = await prisma.taskWeekArchive.findMany({
      where: { storeId: user.storeId },
      orderBy: { archivedAt: "desc" },
      select: { id: true, label: true, archivedAt: true },
    });
    return NextResponse.json({ weeks });
  } catch (e) {
    return handleTasksError("[tasks/weeks GET]", e, "Could not load weeks");
  }
}

/**
 * Start a new week: snapshot the current grid into an immutable archive, then clear every
 * cell (rows and the preset bank are kept). Snapshot + clear run in one transaction so the
 * grid is never cleared without first being saved.
 */
export async function POST(request: Request) {
  const { user, error } = await requireAuth({ allowedRoles: STORE_MANAGER_ROLES });
  if (error) return error;

  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return errorResponse("Invalid week payload");
  if (!prismaHasTaskRow()) return staleClientError();

  try {
    const data = await buildArchiveData(user.storeId);
    const label = await uniqueLabel(user.storeId, parsed.data.label?.trim() || defaultLabel());

    const [week] = await prisma.$transaction([
      prisma.taskWeekArchive.create({
        data: { storeId: user.storeId, label, data: data as unknown as Prisma.InputJsonValue },
        select: { id: true, label: true, archivedAt: true },
      }),
      prisma.taskCell.deleteMany({ where: { row: { storeId: user.storeId } } }),
    ]);
    return NextResponse.json({ week });
  } catch (e) {
    return handleTasksError("[tasks/weeks POST]", e, "Could not start a new week");
  }
}
