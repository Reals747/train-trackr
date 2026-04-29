-- Additive migration: introduces the WEBSITE_DEVELOPER value on the existing Role enum.
-- No tables or columns are dropped; no rows are deleted.
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot be used in the same transaction as a
-- statement that uses the new value. Postgres 12+ allows the ALTER itself inside
-- a transaction, but the new label only becomes usable after that transaction
-- commits. The companion script (prisma/scripts/apply-website-developer-role.ts)
-- applies this in two phases for that reason.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WEBSITE_DEVELOPER';
