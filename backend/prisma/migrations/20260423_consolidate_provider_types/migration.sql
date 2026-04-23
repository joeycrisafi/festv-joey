-- Consolidate ProviderType enum from 10 values down to 5
-- Old: CATERER, DJ, DECORATOR, MUSICIAN, PHOTOGRAPHER, VIDEOGRAPHER, FLORIST, EVENT_PLANNER, BARTENDER, RENTAL_EQUIPMENT, OTHER
-- New: RESTO_VENUE, CATERER, ENTERTAINMENT, PHOTO_VIDEO, FLORIST_DECOR

-- Step 1: Add new enum values
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'RESTO_VENUE';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'ENTERTAINMENT';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'PHOTO_VIDEO';
ALTER TYPE "ProviderType" ADD VALUE IF NOT EXISTS 'FLORIST_DECOR';

-- Step 2: Migrate existing data — ProviderProfile.primaryType
UPDATE "ProviderProfile" SET "primaryType" = 'RESTO_VENUE'    WHERE "primaryType" = 'OTHER';
UPDATE "ProviderProfile" SET "primaryType" = 'ENTERTAINMENT'  WHERE "primaryType" IN ('DJ', 'MUSICIAN', 'BARTENDER');
UPDATE "ProviderProfile" SET "primaryType" = 'PHOTO_VIDEO'    WHERE "primaryType" IN ('PHOTOGRAPHER', 'VIDEOGRAPHER');
UPDATE "ProviderProfile" SET "primaryType" = 'FLORIST_DECOR'  WHERE "primaryType" IN ('FLORIST', 'DECORATOR');
UPDATE "ProviderProfile" SET "primaryType" = 'CATERER'        WHERE "primaryType" IN ('CATERER', 'EVENT_PLANNER', 'RENTAL_EQUIPMENT');

-- Step 3: Migrate ProviderProfile.providerTypes array
UPDATE "ProviderProfile"
SET "providerTypes" = ARRAY(
  SELECT DISTINCT CASE
    WHEN unnested = 'OTHER'            THEN 'RESTO_VENUE'
    WHEN unnested IN ('DJ','MUSICIAN','BARTENDER') THEN 'ENTERTAINMENT'
    WHEN unnested IN ('PHOTOGRAPHER','VIDEOGRAPHER') THEN 'PHOTO_VIDEO'
    WHEN unnested IN ('FLORIST','DECORATOR') THEN 'FLORIST_DECOR'
    WHEN unnested IN ('EVENT_PLANNER','RENTAL_EQUIPMENT') THEN 'CATERER'
    ELSE unnested
  END::\"ProviderType\"
  FROM unnest("providerTypes") AS unnested
);

-- Step 4: Migrate Service.providerType
UPDATE "Service" SET "providerType" = 'RESTO_VENUE'    WHERE "providerType" = 'OTHER';
UPDATE "Service" SET "providerType" = 'ENTERTAINMENT'  WHERE "providerType" IN ('DJ', 'MUSICIAN', 'BARTENDER');
UPDATE "Service" SET "providerType" = 'PHOTO_VIDEO'    WHERE "providerType" IN ('PHOTOGRAPHER', 'VIDEOGRAPHER');
UPDATE "Service" SET "providerType" = 'FLORIST_DECOR'  WHERE "providerType" IN ('FLORIST', 'DECORATOR');
UPDATE "Service" SET "providerType" = 'CATERER'        WHERE "providerType" IN ('EVENT_PLANNER', 'RENTAL_EQUIPMENT');

-- Step 5: Migrate EventRequest.servicesWanted array
UPDATE "EventRequest"
SET "servicesWanted" = ARRAY(
  SELECT DISTINCT CASE
    WHEN unnested = 'OTHER'            THEN 'RESTO_VENUE'
    WHEN unnested IN ('DJ','MUSICIAN','BARTENDER') THEN 'ENTERTAINMENT'
    WHEN unnested IN ('PHOTOGRAPHER','VIDEOGRAPHER') THEN 'PHOTO_VIDEO'
    WHEN unnested IN ('FLORIST','DECORATOR') THEN 'FLORIST_DECOR'
    WHEN unnested IN ('EVENT_PLANNER','RENTAL_EQUIPMENT') THEN 'CATERER'
    ELSE unnested
  END::\"ProviderType\"
  FROM unnest("servicesWanted") AS unnested
)
WHERE array_length("servicesWanted", 1) > 0;

-- Step 6: Remove old enum values (requires recreating the type in Postgres)
-- Create new clean enum
CREATE TYPE "ProviderType_new" AS ENUM ('RESTO_VENUE', 'CATERER', 'ENTERTAINMENT', 'PHOTO_VIDEO', 'FLORIST_DECOR');

-- Swap columns to new type
ALTER TABLE "ProviderProfile"
  ALTER COLUMN "primaryType" TYPE "ProviderType_new" USING "primaryType"::text::"ProviderType_new",
  ALTER COLUMN "providerTypes" TYPE "ProviderType_new"[] USING "providerTypes"::text[]::"ProviderType_new"[];

ALTER TABLE "Service"
  ALTER COLUMN "providerType" TYPE "ProviderType_new" USING "providerType"::text::"ProviderType_new";

ALTER TABLE "EventRequest"
  ALTER COLUMN "servicesWanted" TYPE "ProviderType_new"[] USING "servicesWanted"::text[]::"ProviderType_new"[];

-- Drop old enum and rename new one
DROP TYPE "ProviderType";
ALTER TYPE "ProviderType_new" RENAME TO "ProviderType";
