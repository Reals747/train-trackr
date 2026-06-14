-- Additive: configurable store profiles + profileKey column for dynamic profile tags.

CREATE TABLE "StoreProfile" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'sky',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreProfile_storeId_key_key" ON "StoreProfile"("storeId", "key");
CREATE INDEX "StoreProfile_storeId_sortOrder_idx" ON "StoreProfile"("storeId", "sortOrder");

ALTER TABLE "StoreProfile" ADD CONSTRAINT "StoreProfile_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Position" ADD COLUMN "profileKey" TEXT NOT NULL DEFAULT 'FOH';
UPDATE "Position" SET "profileKey" = "profile"::text;

ALTER TABLE "Trainee" ADD COLUMN "profileKey" TEXT NOT NULL DEFAULT 'FOH';
UPDATE "Trainee" SET "profileKey" = "profile"::text;

ALTER TABLE "TaskRow" ADD COLUMN "profileKey" TEXT NOT NULL DEFAULT 'FOH';
UPDATE "TaskRow" SET "profileKey" = "profile"::text;

ALTER TABLE "TaskPreset" ADD COLUMN "profileKey" TEXT NOT NULL DEFAULT 'FOH';
UPDATE "TaskPreset" SET "profileKey" = "profile"::text;

ALTER TABLE "TaskWeekArchive" ADD COLUMN "profileKey" TEXT NOT NULL DEFAULT 'FOH';
UPDATE "TaskWeekArchive" SET "profileKey" = "profile"::text;

CREATE INDEX "Position_storeId_profileKey_idx" ON "Position"("storeId", "profileKey");
CREATE INDEX "Trainee_storeId_profileKey_idx" ON "Trainee"("storeId", "profileKey");
CREATE INDEX "TaskRow_storeId_profileKey_idx" ON "TaskRow"("storeId", "profileKey");
CREATE INDEX "TaskPreset_storeId_profileKey_idx" ON "TaskPreset"("storeId", "profileKey");
CREATE INDEX "TaskWeekArchive_storeId_profileKey_idx" ON "TaskWeekArchive"("storeId", "profileKey");

DROP INDEX IF EXISTS "Position_storeId_profile_name_key";
CREATE UNIQUE INDEX "Position_storeId_profileKey_name_key" ON "Position"("storeId", "profileKey", "name");

DROP INDEX IF EXISTS "TaskPreset_storeId_profile_text_key";
CREATE UNIQUE INDEX "TaskPreset_storeId_profileKey_text_key" ON "TaskPreset"("storeId", "profileKey", "text");

INSERT INTO "StoreProfile" ("id", "storeId", "key", "name", "color", "sortOrder", "createdAt")
SELECT
    gen_random_uuid()::text,
    s.id,
    'FOH',
    'FOH',
    'sky',
    0,
    NOW()
FROM "Store" s
WHERE NOT EXISTS (
    SELECT 1 FROM "StoreProfile" sp WHERE sp."storeId" = s.id AND sp."key" = 'FOH'
);

INSERT INTO "StoreProfile" ("id", "storeId", "key", "name", "color", "sortOrder", "createdAt")
SELECT
    gen_random_uuid()::text,
    s.id,
    'BOH',
    'BOH',
    'amber',
    1,
    NOW()
FROM "Store" s
WHERE NOT EXISTS (
    SELECT 1 FROM "StoreProfile" sp WHERE sp."storeId" = s.id AND sp."key" = 'BOH'
);
