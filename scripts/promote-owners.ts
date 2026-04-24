import { Role } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

/**
 * For each store that doesn't yet have an OWNER, promote the oldest ADMIN (i.e. the creator)
 * to OWNER so existing data matches the new role model.
 */
async function main() {
  const stores = await prisma.store.findMany({ select: { id: true, name: true } });
  for (const store of stores) {
    const owner = await prisma.user.findFirst({
      where: { storeId: store.id, role: Role.OWNER },
      select: { id: true, username: true },
    });
    if (owner) {
      console.log(`[skip] ${store.name} already has owner ${owner.username}`);
      continue;
    }
    const oldestAdmin = await prisma.user.findFirst({
      where: { storeId: store.id, role: Role.ADMIN },
      orderBy: { createdAt: "asc" },
      select: { id: true, username: true, createdAt: true },
    });
    if (!oldestAdmin) {
      console.log(`[warn] ${store.name} has no admins; leaving untouched`);
      continue;
    }
    await prisma.user.update({
      where: { id: oldestAdmin.id },
      data: { role: Role.OWNER },
    });
    console.log(
      `[promoted] ${store.name}: ${oldestAdmin.username} (created ${oldestAdmin.createdAt.toISOString()}) -> OWNER`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
