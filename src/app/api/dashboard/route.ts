import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type PositionStatus = "complete" | "partial" | "none" | "unavailable";

function checklistStatusFromCounts(
  totalItems: number,
  completedItems: number,
): PositionStatus {
  if (totalItems === 0) return "unavailable";
  if (completedItems === totalItems) return "complete";
  if (completedItems === 0) return "none";
  return "partial";
}

export async function GET() {
  const { user, error } = await requireAuth();
  if (error) return error;

  const [trainees, storePositions] = await Promise.all([
    prisma.trainee.findMany({
      where: { storeId: user.storeId },
      include: {
        progress: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.position.findMany({
      where: { storeId: user.storeId },
      include: {
        items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      },
    }),
  ]);

  const sortedStorePositions = [...storePositions].sort((a, b) => {
    if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const rows = trainees.map((trainee) => {
    const progressByItemId = new Map(
      trainee.progress.map((p) => [p.checklistItemId, p.completed]),
    );

    const positionDetails = sortedStorePositions.map((pos) => {
      const items = pos.items.map((item) => ({
        id: item.id,
        text: item.text,
        completed: progressByItemId.get(item.id) === true,
      }));
      const totalItems = pos.items.length;
      const completedItems = items.filter((i) => i.completed).length;
      const status = checklistStatusFromCounts(totalItems, completedItems);

      return {
        positionId: pos.id,
        name: pos.name,
        hidden: pos.hidden,
        totalItems,
        completedItems,
        status,
        items,
      };
    });

    /** Hidden positions are kept in DB and in `positionDetails` for restore / detail view, but excluded from progress totals. */
    const visibleForProgress = positionDetails.filter((d) => !d.hidden);
    const storePositionCount = visibleForProgress.length;
    const positionsFullyComplete = visibleForProgress.filter((d) => d.status === "complete").length;
    const remainingPositions = storePositionCount - positionsFullyComplete;
    const percentage =
      storePositionCount === 0
        ? 0
        : Math.round((positionsFullyComplete / storePositionCount) * 100);

    return {
      id: trainee.id,
      name: trainee.name,
      percentage,
      positionsFullyComplete,
      storePositionCount,
      remainingPositions,
      positionDetails,
    };
  });

  return NextResponse.json({ trainees: rows });
}
