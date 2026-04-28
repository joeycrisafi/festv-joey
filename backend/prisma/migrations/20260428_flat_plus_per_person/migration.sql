-- Add FLAT_PLUS_PER_PERSON to PricingModel enum
ALTER TYPE "PricingModel" ADD VALUE IF NOT EXISTS 'FLAT_PLUS_PER_PERSON';

-- Add flatFee column to Package table
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "flatFee" DOUBLE PRECISION;
