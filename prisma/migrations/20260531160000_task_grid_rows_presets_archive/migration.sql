-- Restructures the Tasks grid from index-based cells into first-class employee rows,
-- and adds a reusable task "bank" plus immutable weekly archives.
--
-- DATA-PRESERVING: existing TaskCell rows are migrated, not dropped. We add a nullable
-- rowId, materialize a TaskRow per existing (store, rowIndex), relink every cell, seed the
-- preset bank from existing task text, then enforce the new shape.
--
-- Mirrors the project's RLS lockdown: new tables get ENABLE ROW LEVEL SECURITY with no
-- anon/authenticated policies. Prisma over the owner DATABASE_URL bypasses RLS as elsewhere.

-- 1. New tables ------------------------------------------------------------------------------

CREATE TABLE "TaskRow" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskRow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskRow_storeId_order_idx" ON "TaskRow"("storeId", "order");
ALTER TABLE "TaskRow" ADD CONSTRAINT "TaskRow_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TaskPreset" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskPreset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskPreset_storeId_text_key" ON "TaskPreset"("storeId", "text");
CREATE INDEX "TaskPreset_storeId_order_idx" ON "TaskPreset"("storeId", "order");
ALTER TABLE "TaskPreset" ADD CONSTRAINT "TaskPreset_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "TaskWeekArchive" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskWeekArchive_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TaskWeekArchive_storeId_archivedAt_idx" ON "TaskWeekArchive"("storeId", "archivedAt");
ALTER TABLE "TaskWeekArchive" ADD CONSTRAINT "TaskWeekArchive_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Add nullable rowId to TaskCell (filled in below) ---------------------------------------

ALTER TABLE "TaskCell" ADD COLUMN "rowId" TEXT;

-- 3. Materialize one TaskRow per store row index. Every store gets at least 5 rows (the
--    previous fixed client count), plus enough to cover any higher rowIndex already stored.

INSERT INTO "TaskRow" ("id", "storeId", "label", "order", "createdAt")
SELECT gen_random_uuid()::text, s."id", 'Name', g.n, CURRENT_TIMESTAMP
FROM "Store" s
CROSS JOIN LATERAL generate_series(
  0,
  GREATEST(4, COALESCE((SELECT MAX(tc."rowIndex") FROM "TaskCell" tc WHERE tc."storeId" = s."id"), 0))
) AS g(n);

-- 4. Relink every existing cell to its new row by (storeId, rowIndex) -> (TaskRow.order).

UPDATE "TaskCell" c
SET "rowId" = r."id"
FROM "TaskRow" r
WHERE r."storeId" = c."storeId" AND r."order" = c."rowIndex";

-- 5. Seed the preset bank from existing task text (strip checkbox markers, drop blanks).

INSERT INTO "TaskPreset" ("id", "storeId", "text", "order", "createdAt")
SELECT gen_random_uuid()::text, x."storeId", x."text",
       (ROW_NUMBER() OVER (PARTITION BY x."storeId" ORDER BY x."text")) - 1,
       CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT c."storeId" AS "storeId",
    trim(regexp_replace(line, '^\[[ xX]\]\s?', '')) AS "text"
  FROM "TaskCell" c
  CROSS JOIN LATERAL unnest(string_to_array(c."content", E'\n')) AS line
) x
WHERE length(trim(x."text")) > 0
ON CONFLICT ("storeId", "text") DO NOTHING;

-- 6. Enforce the new TaskCell shape: rowId required, FK + unique on (rowId, colIndex),
--    drop the old store-scoped index/columns.

ALTER TABLE "TaskCell" ALTER COLUMN "rowId" SET NOT NULL;

DROP INDEX IF EXISTS "TaskCell_storeId_rowIndex_colIndex_key";
DROP INDEX IF EXISTS "TaskCell_storeId_idx";
ALTER TABLE "TaskCell" DROP CONSTRAINT IF EXISTS "TaskCell_storeId_fkey";
ALTER TABLE "TaskCell" DROP COLUMN "storeId";
ALTER TABLE "TaskCell" DROP COLUMN "rowIndex";

CREATE UNIQUE INDEX "TaskCell_rowId_colIndex_key" ON "TaskCell"("rowId", "colIndex");
CREATE INDEX "TaskCell_rowId_idx" ON "TaskCell"("rowId");
ALTER TABLE "TaskCell" ADD CONSTRAINT "TaskCell_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "TaskRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7. RLS lockdown for the new tables.

ALTER TABLE "TaskRow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskPreset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskWeekArchive" ENABLE ROW LEVEL SECURITY;
