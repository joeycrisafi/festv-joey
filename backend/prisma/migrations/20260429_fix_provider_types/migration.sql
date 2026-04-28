-- Fix ProviderType enum values in production
--
-- Background: 20260423_consolidate_provider_types may have a checksum mismatch
-- in the production _prisma_migrations table (original ADD VALUE version was
-- deployed, then the file was rewritten — different checksum). This migration
-- finishes the job safely using ADD VALUE IF NOT EXISTS (idempotent) so it
-- can be run regardless of whether the enum was partially migrated before.
--
-- The old 11 values: CATERER, DJ, DECORATOR, MUSICIAN, PHOTOGRAPHER,
--   VIDEOGRAPHER, FLORIST, EVENT_PLANNER, BARTENDER, RENTAL_EQUIPMENT, OTHER
-- The new 5 values:  RESTO_VENUE, CATERER, ENTERTAINMENT, PHOTO_VIDEO,
--   FLORIST_DECOR
--
-- ADD VALUE IF NOT EXISTS is idempotent — safe to run even if partially done.
-- The old values are NOT removed (PostgreSQL cannot remove enum values), but
-- all existing data is updated to use new values so the old values become dead.

-- ── Step 1: Add new enum values (idempotent) ────────────────────────────────
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'RESTO_VENUE';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'PHOTO_VIDEO';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'ENTERTAINMENT';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'FLORIST_DECOR';

-- ── Step 2: Update primaryType on existing ProviderProfile rows ─────────────
-- ADD VALUE auto-commits so the new values ARE usable in a separate statement.
UPDATE "ProviderProfile" SET "primaryType" = 'PHOTO_VIDEO'    WHERE "primaryType" = 'PHOTOGRAPHER';
UPDATE "ProviderProfile" SET "primaryType" = 'PHOTO_VIDEO'    WHERE "primaryType" = 'VIDEOGRAPHER';
UPDATE "ProviderProfile" SET "primaryType" = 'ENTERTAINMENT'  WHERE "primaryType" = 'DJ';
UPDATE "ProviderProfile" SET "primaryType" = 'ENTERTAINMENT'  WHERE "primaryType" = 'MUSICIAN';
UPDATE "ProviderProfile" SET "primaryType" = 'RESTO_VENUE'    WHERE "primaryType" = 'BARTENDER';
UPDATE "ProviderProfile" SET "primaryType" = 'RESTO_VENUE'    WHERE "primaryType" = 'OTHER';
UPDATE "ProviderProfile" SET "primaryType" = 'FLORIST_DECOR'  WHERE "primaryType" = 'FLORIST';
UPDATE "ProviderProfile" SET "primaryType" = 'FLORIST_DECOR'  WHERE "primaryType" = 'DECORATOR';
UPDATE "ProviderProfile" SET "primaryType" = 'CATERER'        WHERE "primaryType" = 'EVENT_PLANNER';
UPDATE "ProviderProfile" SET "primaryType" = 'CATERER'        WHERE "primaryType" = 'RENTAL_EQUIPMENT';

-- ── Step 3: Update providerTypes array column ────────────────────────────────
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'PHOTOGRAPHER',    'PHOTO_VIDEO')::   "ProviderType"[] WHERE 'PHOTOGRAPHER'    = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'VIDEOGRAPHER',    'PHOTO_VIDEO')::   "ProviderType"[] WHERE 'VIDEOGRAPHER'    = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'DJ',              'ENTERTAINMENT'):: "ProviderType"[] WHERE 'DJ'              = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'MUSICIAN',        'ENTERTAINMENT'):: "ProviderType"[] WHERE 'MUSICIAN'        = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'BARTENDER',       'RESTO_VENUE')::   "ProviderType"[] WHERE 'BARTENDER'       = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'OTHER',           'RESTO_VENUE')::   "ProviderType"[] WHERE 'OTHER'           = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'FLORIST',         'FLORIST_DECOR'):: "ProviderType"[] WHERE 'FLORIST'         = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'DECORATOR',       'FLORIST_DECOR'):: "ProviderType"[] WHERE 'DECORATOR'       = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'EVENT_PLANNER',   'CATERER')::       "ProviderType"[] WHERE 'EVENT_PLANNER'   = ANY("providerTypes"::text[]);
UPDATE "ProviderProfile" SET "providerTypes" = array_replace("providerTypes"::text[], 'RENTAL_EQUIPMENT','CATERER')::       "ProviderType"[] WHERE 'RENTAL_EQUIPMENT' = ANY("providerTypes"::text[]);
