-- CreateTable
CREATE TABLE "ScheduleDayCache" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "profileKey" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "employees" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleDayCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleDayCache_storeId_profileKey_dateKey_idx" ON "ScheduleDayCache"("storeId", "profileKey", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDayCache_storeId_profileKey_dateKey_key" ON "ScheduleDayCache"("storeId", "profileKey", "dateKey");

-- AddForeignKey
ALTER TABLE "ScheduleDayCache" ADD CONSTRAINT "ScheduleDayCache_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
