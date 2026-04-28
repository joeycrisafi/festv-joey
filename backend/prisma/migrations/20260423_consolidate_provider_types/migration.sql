-- NO-OP: superseded by 20260429_fix_provider_types
--
-- This migration originally attempted to consolidate ProviderType enum values
-- using a DROP TYPE / CREATE TYPE approach. It was rewritten once to fix a
-- PostgreSQL transaction limitation, but may have a checksum mismatch in the
-- production _prisma_migrations table.
--
-- The actual enum migration is handled by 20260429_fix_provider_types using
-- ADD VALUE IF NOT EXISTS (idempotent, no DROP TYPE needed).
--
-- This file is intentionally a no-op so it can be safely applied regardless
-- of prior state. If _prisma_migrations already contains this migration with
-- a DIFFERENT checksum, prisma migrate deploy will fail with "checksum
-- mismatch" — resolve it by running on the Render shell:
--   npx prisma migrate resolve --applied 20260423_consolidate_provider_types

SELECT 1;
