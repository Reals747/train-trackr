-- Additive migration: adds Position.order and ChecklistItem.kind, backfills Position.order.
-- No existing rows are deleted. Existing data (names, items, descriptions, progress) are preserved.

-- AlterTable: add Position.order with safe default
ALTER TABLE "Position" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: add ChecklistItem.kind with safe default; existing rows become "item"
ALTER TABLE "ChecklistItem" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'item';

-- Backfill Position.order: rank existing positions per store by current alphabetical name
-- so the first user-visible order matches what they currently see today.
WITH ranked AS (
  SELECT
    "id",
    (ROW_NUMBER() OVER (PARTITION BY "storeId" ORDER BY "name" ASC) - 1) AS new_order
  FROM "Position"
)
UPDATE "Position" AS p
SET "order" = ranked.new_order
FROM ranked
WHERE p."id" = ranked."id";

-- CreateIndex: speeds up storewide ordered listings.
CREATE INDEX "Position_storeId_order_idx" ON "Position"("storeId", "order");
