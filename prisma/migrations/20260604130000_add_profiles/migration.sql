-- Additive-only: FOH/BOH profile dimension. All existing rows backfill to FOH via column defaults.

-- CreateEnum
CREATE TYPE "Profile" AS ENUM ('FOH', 'BOH');

-- User.activeProfile (view filter: FOH | BOH | BOTH)
ALTER TABLE "User" ADD COLUMN "activeProfile" TEXT NOT NULL DEFAULT 'FOH';

-- Entity profile tags (default FOH preserves all live data)
ALTER TABLE "Position" ADD COLUMN "profile" "Profile" NOT NULL DEFAULT 'FOH';
ALTER TABLE "Trainee" ADD COLUMN "profile" "Profile" NOT NULL DEFAULT 'FOH';
ALTER TABLE "TaskRow" ADD COLUMN "profile" "Profile" NOT NULL DEFAULT 'FOH';
ALTER TABLE "TaskPreset" ADD COLUMN "profile" "Profile" NOT NULL DEFAULT 'FOH';
ALTER TABLE "TaskWeekArchive" ADD COLUMN "profile" "Profile" NOT NULL DEFAULT 'FOH';

-- Widen unique indexes so the same name/text can exist per profile (no data loss)
DROP INDEX IF EXISTS "Position_storeId_name_key";
CREATE UNIQUE INDEX "Position_storeId_profile_name_key" ON "Position"("storeId", "profile", "name");
CREATE INDEX "Position_storeId_profile_idx" ON "Position"("storeId", "profile");

CREATE INDEX "Trainee_storeId_profile_idx" ON "Trainee"("storeId", "profile");

CREATE INDEX "TaskRow_storeId_profile_idx" ON "TaskRow"("storeId", "profile");

DROP INDEX IF EXISTS "TaskPreset_storeId_text_key";
CREATE UNIQUE INDEX "TaskPreset_storeId_profile_text_key" ON "TaskPreset"("storeId", "profile", "text");
CREATE INDEX "TaskPreset_storeId_profile_idx" ON "TaskPreset"("storeId", "profile");

CREATE INDEX "TaskWeekArchive_storeId_profile_idx" ON "TaskWeekArchive"("storeId", "profile");
