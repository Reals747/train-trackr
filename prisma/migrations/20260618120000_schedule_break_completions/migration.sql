-- CreateTable
CREATE TABLE "ScheduleBreakCompletion" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "breakKey" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleBreakCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleBreakCompletion_storeId_profileKey_dateKey_idx" ON "ScheduleBreakCompletion"("storeId", "profileKey", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleBreakCompletion_storeId_profileKey_dateKey_employeeId_breakKey_key" ON "ScheduleBreakCompletion"("storeId", "profileKey", "dateKey", "employeeId", "breakKey");

-- AddForeignKey
ALTER TABLE "ScheduleBreakCompletion" ADD CONSTRAINT "ScheduleBreakCompletion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
