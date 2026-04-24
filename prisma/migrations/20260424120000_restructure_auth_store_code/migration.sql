-- Restructure auth: User.email -> username (unique per store), make passwordHash optional,
-- add permanent Store.storeCode, and drop one-time trainer invite fields.

-- 1) User.passwordHash becomes optional (null for password-less trainers).
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- 2) Drop the global email-uniqueness index that Prisma generated from `email @unique`.
DROP INDEX IF EXISTS "User_email_key";

-- 3) Rename User.email -> User.username (preserves existing data as login identifiers).
ALTER TABLE "User" RENAME COLUMN "email" TO "username";

-- 4) Username must be unique within a store (different stores may reuse the same username).
CREATE UNIQUE INDEX "User_storeId_username_key" ON "User"("storeId", "username");

-- 5) Add Store.storeCode as a permanent, unique 8-digit join code.
ALTER TABLE "Store" ADD COLUMN "storeCode" TEXT;

-- Populate any existing stores with random 8-digit codes (range 10000000..99999999).
-- Collision risk is negligible for the small dev datasets this migration targets.
UPDATE "Store"
SET "storeCode" = LPAD((10000000 + floor(random() * 89999999))::int::text, 8, '0')
WHERE "storeCode" IS NULL;

ALTER TABLE "Store" ALTER COLUMN "storeCode" SET NOT NULL;
CREATE UNIQUE INDEX "Store_storeCode_key" ON "Store"("storeCode");

-- 6) Drop the old one-time trainer invite columns (replaced by permanent Store.storeCode).
ALTER TABLE "StoreSetting" DROP COLUMN IF EXISTS "trainerInviteCode";
ALTER TABLE "StoreSetting" DROP COLUMN IF EXISTS "trainerInviteExpiresAt";
