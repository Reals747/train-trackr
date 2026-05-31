-- Additive only: creates the store-scoped Tasks grid table. Does NOT touch any existing
-- table or data. Mirrors the project's RLS lockdown by enabling row level security with
-- no anon/authenticated policies (the Supabase Data API cannot read/write); Prisma over the
-- table-owner DATABASE_URL bypasses RLS as it does for every other table.

-- CreateTable
CREATE TABLE "TaskCell" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "colIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskCell_storeId_idx" ON "TaskCell"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCell_storeId_rowIndex_colIndex_key" ON "TaskCell"("storeId", "rowIndex", "colIndex");

-- AddForeignKey
ALTER TABLE "TaskCell" ADD CONSTRAINT "TaskCell_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Match the RLS lockdown applied to all other public tables.
ALTER TABLE "TaskCell" ENABLE ROW LEVEL SECURITY;
