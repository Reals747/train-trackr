-- StoreProfile: optional Fourth schedule filter overrides per profile.
ALTER TABLE "StoreProfile" ADD COLUMN IF NOT EXISTS "scheduleLocationKeyword" TEXT;
ALTER TABLE "StoreProfile" ADD COLUMN IF NOT EXISTS "scheduleDepartmentKeyword" TEXT;

-- ScheduleDayCache: one raw Fourth shift payload per store + business day (not per profile).
DELETE FROM "ScheduleDayCache";

DROP INDEX IF EXISTS "ScheduleDayCache_storeId_profileKey_dateKey_key";
DROP INDEX IF EXISTS "ScheduleDayCache_storeId_profileKey_dateKey_idx";

ALTER TABLE "ScheduleDayCache" DROP COLUMN IF EXISTS "profileKey";
ALTER TABLE "ScheduleDayCache" DROP COLUMN IF EXISTS "source";
ALTER TABLE "ScheduleDayCache" RENAME COLUMN "employees" TO "shifts";

CREATE UNIQUE INDEX IF NOT EXISTS "ScheduleDayCache_storeId_dateKey_key"
  ON "ScheduleDayCache"("storeId", "dateKey");

CREATE INDEX IF NOT EXISTS "ScheduleDayCache_storeId_dateKey_idx"
  ON "ScheduleDayCache"("storeId", "dateKey");
