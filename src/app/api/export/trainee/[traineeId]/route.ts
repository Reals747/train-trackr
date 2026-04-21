import { requireAuth } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function toCsv(rows: Record<string, string>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const headerLine = headers.join(",");
  const bodyLines = rows.map((row) =>
    headers
      .map((header) => `"${String(row[header] ?? "").replaceAll("\"", "\"\"")}"`)
      .join(","),
  );
  return [headerLine, ...bodyLines].join("\n");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ traineeId: string }> },
) {
  const { user, error } = await requireAuth();
  if (error) return error;
  const { traineeId } = await params;

  const trainee = await prisma.trainee.findFirst({
    where: { id: traineeId, storeId: user.storeId },
    include: {
      positions: {
        include: {
          position: {
            include: {
              items: {
                include: {
                  progress: {
                    where: { traineeId },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!trainee) {
    return new Response("Not found", { status: 404 });
  }

  const rows: Record<string, string>[] = [];
  for (const assignment of trainee.positions) {
    for (const item of assignment.position.items) {
      const p = item.progress[0];
      rows.push({
        trainee: trainee.name,
        position: assignment.position.name,
        item: item.text,
        completed: p?.completed ? "Yes" : "No",
        trainer: p?.trainerName ?? "",
        notes: p?.notes ?? "",
        completedAt: p?.completedAt ? p.completedAt.toISOString() : "",
      });
    }
  }

  const csv = toCsv(rows);
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${trainee.name.replaceAll(" ", "-").toLowerCase()}-progress.csv"`,
    },
  });
}
