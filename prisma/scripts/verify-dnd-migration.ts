/** Read-only verification: confirms the migration applied and data is healthy. */
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();

  const positions = await prisma.position.findMany({
    select: { id: true, name: true, order: true, storeId: true, hidden: true },
    orderBy: [{ storeId: "asc" }, { order: "asc" }],
  });

  const byStore = new Map<string, typeof positions>();
  for (const p of positions) {
    const list = byStore.get(p.storeId) ?? [];
    list.push(p);
    byStore.set(p.storeId, list);
  }

  console.log(`[verify] total positions: ${positions.length}`);
  for (const [storeId, list] of byStore) {
    const orders = list.map((p) => p.order);
    const expected = orders.slice().sort((a, b) => a - b);
    const looksDistinct = new Set(orders).size === orders.length;
    console.log(
      `[verify] store ${storeId.slice(0, 8)}…: ${list.length} positions, orders ${orders.join(", ")} ${
        looksDistinct ? "(distinct ✓)" : "(NOT distinct — review)"
      } sorted=${JSON.stringify(orders) === JSON.stringify(expected) ? "yes" : "no"}`,
    );
  }

  const itemKindCounts = await prisma.checklistItem.groupBy({
    by: ["kind"],
    _count: { _all: true },
  });
  console.log(
    "[verify] checklist items by kind:",
    Object.fromEntries(itemKindCounts.map((r) => [r.kind, r._count._all])),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
