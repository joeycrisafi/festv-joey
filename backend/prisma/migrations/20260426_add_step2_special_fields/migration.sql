-- Add Step 2 type-specific special fields to ProviderProfile

-- RESTO_VENUE
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "seatedCapacity"          INTEGER;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "standingCapacity"        INTEGER;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "venueCuisine"            TEXT;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "venueIndoorOutdoor"      TEXT;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "avTechAvailable"         BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "dietaryOptions"          TEXT[]  NOT NULL DEFAULT '{}';

-- CATERER
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "equipmentRentalAvailable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "caterSetupIncluded"       BOOLEAN NOT NULL DEFAULT false;

-- ENTERTAINMENT
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "genreTags"              TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "setupTimeMinutes"       INTEGER;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "equipmentIncluded"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "overtimeRatePerHour"    DOUBLE PRECISION;

-- PHOTO_VIDEO
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "styleTags"              TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "deliveryTimelineDays"   INTEGER;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "editedPhotosCount"      INTEGER;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "travelFeePolicy"        TEXT;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "rawFilesIncluded"       BOOLEAN NOT NULL DEFAULT false;

-- FLORIST_DECOR
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "floristStyleTags"       TEXT[]  NOT NULL DEFAULT '{}';
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "seasonalCustomFloral"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "floristSetupIncluded"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ProviderProfile" ADD COLUMN IF NOT EXISTS "rentalItemsAvailable"   BOOLEAN NOT NULL DEFAULT false;
