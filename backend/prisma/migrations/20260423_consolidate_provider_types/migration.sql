-- Consolidate ProviderType enum from 11 values down to 5
-- Old: CATERER, DJ, DECORATOR, MUSICIAN, PHOTOGRAPHER, VIDEOGRAPHER, FLORIST, EVENT_PLANNER, BARTENDER, RENTAL_EQUIPMENT, OTHER
-- New: RESTO_VENUE, CATERER, ENTERTAINMENT, PHOTO_VIDEO, FLORIST_DECOR
--
-- NOTE: We skip ADD VALUE entirely (can't use new values in same transaction).
-- Instead we cast all columns to TEXT, swap to a brand-new enum, then clean up.

-- Step 1: Cast all enum columns to TEXT so we can freely migrate values

ALTER TABLE "ProviderProfile"
  ALTER COLUMN "primaryType"   TYPE TEXT USING "primaryType"::TEXT,
  ALTER COLUMN "providerTypes" TYPE TEXT[] USING "providerTypes"::TEXT[];

ALTER TABLE "Service"
  ALTER COLUMN "providerType" TYPE TEXT USING "providerType"::TEXT;

ALTER TABLE "EventRequest"
  ALTER COLUMN "servicesWanted" TYPE TEXT[] USING "servicesWanted"::TEXT[];

-- Step 2: Migrate TEXT values — ProviderProfile.primaryType
UPDATE "ProviderProfile" SET "primaryType" = 'RESTO_VENUE'    WHERE "primaryType" = 'OTHER';
UPDATE "ProviderProfile" SET "primaryType" = 'ENTERTAINMENT'  WHERE "primaryType" IN ('DJ', 'MUSICIAN', 'BARTENDER');
UPDATE "ProviderProfile" SET "primaryType" = 'PHOTO_VIDEO'    WHERE "primaryType" IN ('PHOTOGRAPHER', 'VIDEOGRAPHER');
UPDATE "ProviderProfile" SET "primaryType" = 'FLORIST_DECOR'  WHERE "primaryType" IN ('FLORIST', 'DECORATOR');
UPDATE "ProviderProfile" SET "primaryType" = 'CATERER'        WHERE "primaryType" IN ('EVENT_PLANNER', 'RENTAL_EQUIPMENT');

-- Step 3: Migrate ProviderProfile.providerTypes array
UPDATE "ProviderProfile"
SET "providerTypes" = ARRAY(
  SELECT DISTINCT CASE
    WHEN unnested = 'OTHER'                              THEN 'RESTO_VENUE'
    WHEN unnested IN ('DJ', 'MUSICIAN', 'BARTENDER')    THEN 'ENTERTAINMENT'
    WHEN unnested IN ('PHOTOGRAPHER', 'VIDEOGRAPHER')   THEN 'PHOTO_VIDEO'
    WHEN unnested IN ('FLORIST', 'DECORATOR')           THEN 'FLORIST_DECOR'
    WHEN unnested IN ('EVENT_PLANNER', 'RENTAL_EQUIPMENT') THEN 'CATERER'
    ELSE unnested
  END
  FROM unnest("providerTypes") AS unnested
)
WHERE array_length("providerTypes", 1) > 0;

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
    WHEN unnested = 'OTHER'                              THEN 'RESTO_VENUE'
    WHEN unnested IN ('DJ', 'MUSICIAN', 'BARTENDER')    THEN 'ENTERTAINMENT'
    WHEN unnested IN ('PHOTOGRAPHER', 'VIDEOGRAPHER')   THEN 'PHOTO_VIDEO'
    WHEN unnested IN ('FLORIST', 'DECORATOR')           THEN 'FLORIST_DECOR'
    WHEN unnested IN ('EVENT_PLANNER', 'RENTAL_EQUIPMENT') THEN 'CATERER'
    ELSE unnested
  END
  FROM unnest("servicesWanted") AS unnested
)
WHERE array_length("servicesWanted", 1) > 0;

-- Step 6: Drop the old enum (columns are now TEXT)
DROP TYPE "ProviderType";

-- Step 7: Create the new clean enum
CREATE TYPE "ProviderType" AS ENUM ('RESTO_VENUE', 'CATERER', 'ENTERTAINMENT', 'PHOTO_VIDEO', 'FLORIST_DECOR');

-- Step 8: Cast TEXT columns back to the new enum
ALTER TABLE "ProviderProfile"
  ALTER COLUMN "primaryType"   TYPE "ProviderType" USING "primaryType"::"ProviderType",
  ALTER COLUMN "providerTypes" TYPE "ProviderType"[] USING "providerTypes"::"ProviderType"[];

ALTER TABLE "Service"
  ALTER COLUMN "providerType" TYPE "ProviderType" USING "providerType"::"ProviderType";

ALTER TABLE "EventRequest"
  ALTER COLUMN "servicesWanted" TYPE "ProviderType"[] USING "servicesWanted"::"ProviderType"[];
