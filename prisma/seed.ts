import { Role } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { generateUniqueStoreCode } from "../src/lib/store-code";

async function main() {
  await prisma.trainingProgress.deleteMany();
  await prisma.traineePosition.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.position.deleteMany();
  await prisma.user.deleteMany();
  await prisma.storeSetting.deleteMany();
  await prisma.trainee.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.store.deleteMany();

  const storeCode = await generateUniqueStoreCode();
  const store = await prisma.store.create({
    data: {
      name: "Demo Chick-fil-A Style Store",
      storeCode,
      settings: { create: { trainerCanViewAll: true, darkModeEnabled: false } },
    },
  });

  const [adminPass, viewerPass] = await Promise.all([
    hashPassword("Admin1234!"),
    hashPassword("Viewer1234!"),
  ]);

  const admin = await prisma.user.create({
    data: {
      name: "Operator Admin",
      username: "admin",
      passwordHash: adminPass,
      role: Role.OWNER,
      storeId: store.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Shift Trainer",
      username: "trainer",
      role: Role.TRAINER,
      storeId: store.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Viewer User",
      username: "viewer",
      passwordHash: viewerPass,
      role: Role.VIEWER,
      storeId: store.id,
    },
  });

  const windowPos = await prisma.position.create({ data: { storeId: store.id, name: "Window" } });
  const baggingPos = await prisma.position.create({ data: { storeId: store.id, name: "Bagging" } });

  const items = await prisma.$transaction([
    prisma.checklistItem.create({ data: { positionId: windowPos.id, text: "Greet guest within 3 seconds", order: 0 } }),
    prisma.checklistItem.create({ data: { positionId: windowPos.id, text: "Confirm order details", order: 1 } }),
    prisma.checklistItem.create({ data: { positionId: baggingPos.id, text: "Match bag label to order", order: 0 } }),
    prisma.checklistItem.create({ data: { positionId: baggingPos.id, text: "Verify sauces and napkins", order: 1 } }),
  ]);

  const trainee = await prisma.trainee.create({
    data: {
      storeId: store.id,
      name: "Jordan Team Member",
      startDate: new Date(),
      positions: {
        create: [{ positionId: windowPos.id }, { positionId: baggingPos.id }],
      },
    },
  });

  await prisma.trainingProgress.create({
    data: {
      traineeId: trainee.id,
      checklistItemId: items[0].id,
      completed: true,
      trainerName: "Shift Trainer",
      notes: "Strong guest eye contact.",
      completedById: admin.id,
      completedAt: new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      storeId: store.id,
      userId: admin.id,
      message: "Seeded demo data for Training Tracker",
    },
  });

  console.log(`Seeded store "${store.name}" with storeCode=${store.storeCode}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
