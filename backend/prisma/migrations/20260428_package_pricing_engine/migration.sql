-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20260428_package_pricing_engine
-- Replace Service / PricingLevel / old Quote / old Booking models with a
-- new package-based pricing engine.
--
-- DO NOT APPLY YET — reviewed and applied separately.
--
-- Replaces:  Service, PricingLevel, QuoteItem, BookingService
-- Redesigns: EventRequest (vendor-direct), Quote, Booking
-- Adds:      Package, SeasonalPricingRule, DayOfWeekPricingRule,
--            AddOn, _PackageAddOns, AvailabilityBlock
-- New enums: PricingModel, AddOnPricingType, DayOfWeek, AvailabilityBlockReason
-- Alters:    EventRequestStatus (full replacement), BookingStatus (+PENDING_REVIEW),
--            EventType (+BRIDAL_SHOWER, +SOCIAL)
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 1: Detach Payment and Review from old Booking
-- (they are kept; we need to drop + recreate the FK after Booking is rebuilt)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_bookingId_fkey";
ALTER TABLE "Review"  DROP CONSTRAINT IF EXISTS "Review_bookingId_fkey";

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 2: Drop tables being replaced (leaf → root order)
-- ───────────────────────────────────────────────────────────────────────────

-- Leaf tables that depend on Booking
DROP TABLE IF EXISTS "BookingService";

-- Booking (depends on old EventRequest and old Quote)
DROP TABLE IF EXISTS "Booking";

-- QuoteItem (depends on old Quote)
DROP TABLE IF EXISTS "QuoteItem";

-- Old Quote
DROP TABLE IF EXISTS "Quote";

-- Old EventRequest M2M join tables (must drop before EventRequest)
DROP TABLE IF EXISTS "_CuisineTypeToEventRequest";
DROP TABLE IF EXISTS "_EquipmentToEventRequest";
DROP TABLE IF EXISTS "_EventRequestToEventTheme";

-- Old EventRequest
DROP TABLE IF EXISTS "EventRequest";

-- Service and PricingLevel (depend on ProviderProfile)
DROP TABLE IF EXISTS "Service";
DROP TABLE IF EXISTS "PricingLevel";

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 3: Replace EventRequestStatus enum
-- PostgreSQL cannot remove enum values, so we drop and recreate.
-- The table was dropped above so there are no column dependencies.
-- ───────────────────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS "EventRequestStatus";
CREATE TYPE "EventRequestStatus" AS ENUM (
    'PENDING',
    'QUOTE_SENT',
    'ACCEPTED',
    'DECLINED',
    'EXPIRED'
);

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 4: Create new enum types
-- ───────────────────────────────────────────────────────────────────────────
CREATE TYPE "PricingModel" AS ENUM (
    'PER_PERSON',
    'FLAT_RATE',
    'PER_HOUR'
);

CREATE TYPE "AddOnPricingType" AS ENUM (
    'FLAT',
    'PER_PERSON',
    'PER_HOUR'
);

CREATE TYPE "DayOfWeek" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
);

CREATE TYPE "AvailabilityBlockReason" AS ENUM (
    'BOOKED_EXTERNAL',
    'CLOSED',
    'PERSONAL',
    'MAINTENANCE'
);

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 5: Add missing values to existing enums
-- (ADD VALUE IF NOT EXISTS is idempotent in Postgres 9.6+)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TYPE "EventType"     ADD VALUE IF NOT EXISTS 'BRIDAL_SHOWER';
ALTER TYPE "EventType"     ADD VALUE IF NOT EXISTS 'SOCIAL';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 6: Package pricing engine tables
-- ───────────────────────────────────────────────────────────────────────────

-- Package ----------------------------------------------------------------
CREATE TABLE "Package" (
    "id"                TEXT             NOT NULL,
    "providerProfileId" TEXT             NOT NULL,
    "name"              TEXT             NOT NULL,
    "description"       TEXT,
    "category"          TEXT             NOT NULL,
    "eventTypes"        "EventType"[],
    "pricingModel"      "PricingModel"   NOT NULL,
    "basePrice"         DOUBLE PRECISION NOT NULL,
    "minimumSpend"      DOUBLE PRECISION,
    "minGuests"         INTEGER,
    "maxGuests"         INTEGER,
    "durationHours"     DOUBLE PRECISION,
    "weekdayPrice"      DOUBLE PRECISION,
    "weekendPrice"      DOUBLE PRECISION,
    "included"          TEXT[]           NOT NULL DEFAULT '{}',
    "isActive"          BOOLEAN          NOT NULL DEFAULT true,
    "sortOrder"         INTEGER          NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- SeasonalPricingRule -----------------------------------------------------
CREATE TABLE "SeasonalPricingRule" (
    "id"                   TEXT             NOT NULL,
    "packageId"            TEXT             NOT NULL,
    "name"                 TEXT             NOT NULL,
    "startMonth"           INTEGER          NOT NULL,
    "startDay"             INTEGER          NOT NULL,
    "endMonth"             INTEGER          NOT NULL,
    "endDay"               INTEGER          NOT NULL,
    "priceOverride"        DOUBLE PRECISION,
    "minimumSpendOverride" DOUBLE PRECISION,
    "multiplier"           DOUBLE PRECISION,
    CONSTRAINT "SeasonalPricingRule_pkey" PRIMARY KEY ("id")
);

-- DayOfWeekPricingRule ----------------------------------------------------
CREATE TABLE "DayOfWeekPricingRule" (
    "id"                   TEXT             NOT NULL,
    "packageId"            TEXT             NOT NULL,
    "days"                 "DayOfWeek"[]    NOT NULL DEFAULT '{}',
    "priceOverride"        DOUBLE PRECISION,
    "minimumSpendOverride" DOUBLE PRECISION,
    CONSTRAINT "DayOfWeekPricingRule_pkey" PRIMARY KEY ("id")
);

-- AddOn -------------------------------------------------------------------
CREATE TABLE "AddOn" (
    "id"                TEXT                NOT NULL,
    "providerProfileId" TEXT                NOT NULL,
    "name"              TEXT                NOT NULL,
    "description"       TEXT,
    "pricingType"       "AddOnPricingType"  NOT NULL,
    "price"             DOUBLE PRECISION    NOT NULL,
    "minimumSpend"      DOUBLE PRECISION,
    "isRequired"        BOOLEAN             NOT NULL DEFAULT false,
    "isActive"          BOOLEAN             NOT NULL DEFAULT true,
    "sortOrder"         INTEGER             NOT NULL DEFAULT 0,
    "createdAt"         TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)        NOT NULL,
    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- _PackageAddOns (implicit M2M join: Package <-> AddOn) -------------------
CREATE TABLE "_PackageAddOns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- AvailabilityBlock -------------------------------------------------------
CREATE TABLE "AvailabilityBlock" (
    "id"                TEXT                        NOT NULL,
    "providerProfileId" TEXT                        NOT NULL,
    "startDate"         TIMESTAMP(3)                NOT NULL,
    "endDate"           TIMESTAMP(3)                NOT NULL,
    "reason"            "AvailabilityBlockReason"   NOT NULL,
    "note"              TEXT,
    "createdAt"         TIMESTAMP(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 7: New EventRequest (vendor-direct)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "EventRequest" (
    "id"                 TEXT                 NOT NULL,
    "clientId"           TEXT                 NOT NULL,
    "providerProfileId"  TEXT                 NOT NULL,
    "packageId"          TEXT,
    "eventType"          "EventType"          NOT NULL,
    "eventDate"          TIMESTAMP(3)         NOT NULL,
    "guestCount"         INTEGER              NOT NULL,
    "durationHours"      DOUBLE PRECISION,
    "selectedAddOnIds"   TEXT[]               NOT NULL DEFAULT '{}',
    "specialRequests"    TEXT,
    "calculatedEstimate" DOUBLE PRECISION,
    "isOutOfParameters"  BOOLEAN              NOT NULL DEFAULT false,
    "status"             "EventRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt"          TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3)         NOT NULL,
    CONSTRAINT "EventRequest_pkey" PRIMARY KEY ("id")
);

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 8: New Quote (package-anchored, JSON add-ons + adjustments)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "Quote" (
    "id"                TEXT             NOT NULL,
    "eventRequestId"    TEXT             NOT NULL,
    "providerProfileId" TEXT             NOT NULL,
    "packageId"         TEXT,
    "version"           INTEGER          NOT NULL DEFAULT 1,
    "eventDate"         TIMESTAMP(3)     NOT NULL,
    "guestCount"        INTEGER          NOT NULL,
    "durationHours"     DOUBLE PRECISION,
    "packagePrice"      DOUBLE PRECISION NOT NULL,
    "minimumSpend"      DOUBLE PRECISION,
    -- [{addOnId, name, pricingType, price, quantity, total}]
    "addOns"            JSONB            NOT NULL DEFAULT '[]',
    "addOnsTotal"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    -- [{description, amount}] — negative values for discounts
    "adjustments"       JSONB            NOT NULL DEFAULT '[]',
    "adjustmentsTotal"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal"          DOUBLE PRECISION NOT NULL,
    "tax"               DOUBLE PRECISION NOT NULL,
    "total"             DOUBLE PRECISION NOT NULL,
    "depositAmount"     DOUBLE PRECISION NOT NULL,
    "isAutoGenerated"   BOOLEAN          NOT NULL DEFAULT false,
    "isOutOfParameters" BOOLEAN          NOT NULL DEFAULT false,
    "vendorMessage"     TEXT,
    "expiresAt"         TIMESTAMP(3),
    "status"            "QuoteStatus"    NOT NULL DEFAULT 'DRAFT',
    "createdAt"         TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 9: New Booking (financial snapshot; no eventRequestId FK)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "Booking" (
    "id"               TEXT             NOT NULL,
    "clientId"         TEXT             NOT NULL,
    "providerProfileId" TEXT            NOT NULL,
    "packageId"        TEXT             NOT NULL,
    "quoteId"          TEXT             NOT NULL,
    "eventType"        "EventType"      NOT NULL,
    "eventDate"        TIMESTAMP(3)     NOT NULL,
    "guestCount"       INTEGER          NOT NULL,
    "durationHours"    DOUBLE PRECISION,
    "packagePrice"     DOUBLE PRECISION NOT NULL,
    "addOnsTotal"      DOUBLE PRECISION NOT NULL,
    "adjustmentsTotal" DOUBLE PRECISION NOT NULL,
    "subtotal"         DOUBLE PRECISION NOT NULL,
    "tax"              DOUBLE PRECISION NOT NULL,
    "total"            DOUBLE PRECISION NOT NULL,
    "depositAmount"    DOUBLE PRECISION NOT NULL,
    "depositPaidAt"    TIMESTAMP(3),
    "status"           "BookingStatus"  NOT NULL DEFAULT 'PENDING_DEPOSIT',
    "vendorNotes"      TEXT,
    "specialRequests"  TEXT,
    "createdAt"        TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)     NOT NULL,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 10: Indexes
-- ───────────────────────────────────────────────────────────────────────────

-- Package
CREATE INDEX "Package_providerProfileId_idx" ON "Package"("providerProfileId");
CREATE INDEX "Package_isActive_idx"           ON "Package"("isActive");
CREATE INDEX "Package_category_idx"           ON "Package"("category");
CREATE INDEX "Package_pricingModel_idx"       ON "Package"("pricingModel");

-- SeasonalPricingRule
CREATE INDEX "SeasonalPricingRule_packageId_idx" ON "SeasonalPricingRule"("packageId");

-- DayOfWeekPricingRule
CREATE INDEX "DayOfWeekPricingRule_packageId_idx" ON "DayOfWeekPricingRule"("packageId");

-- AddOn
CREATE INDEX "AddOn_providerProfileId_idx" ON "AddOn"("providerProfileId");
CREATE INDEX "AddOn_isActive_idx"           ON "AddOn"("isActive");

-- _PackageAddOns
CREATE UNIQUE INDEX "_PackageAddOns_AB_unique" ON "_PackageAddOns"("A", "B");
CREATE INDEX        "_PackageAddOns_B_index"   ON "_PackageAddOns"("B");

-- AvailabilityBlock
CREATE INDEX "AvailabilityBlock_providerProfileId_idx"   ON "AvailabilityBlock"("providerProfileId");
CREATE INDEX "AvailabilityBlock_startDate_endDate_idx"   ON "AvailabilityBlock"("startDate", "endDate");

-- EventRequest
CREATE INDEX "EventRequest_clientId_idx"          ON "EventRequest"("clientId");
CREATE INDEX "EventRequest_providerProfileId_idx" ON "EventRequest"("providerProfileId");
CREATE INDEX "EventRequest_status_idx"            ON "EventRequest"("status");
CREATE INDEX "EventRequest_eventDate_idx"         ON "EventRequest"("eventDate");
CREATE INDEX "EventRequest_packageId_idx"         ON "EventRequest"("packageId");

-- Quote
CREATE INDEX "Quote_eventRequestId_idx"    ON "Quote"("eventRequestId");
CREATE INDEX "Quote_providerProfileId_idx" ON "Quote"("providerProfileId");
CREATE INDEX "Quote_packageId_idx"         ON "Quote"("packageId");
CREATE INDEX "Quote_status_idx"            ON "Quote"("status");

-- Booking
CREATE UNIQUE INDEX "Booking_quoteId_key"                ON "Booking"("quoteId");
CREATE INDEX        "Booking_clientId_idx"               ON "Booking"("clientId");
CREATE INDEX        "Booking_providerProfileId_idx"      ON "Booking"("providerProfileId");
CREATE INDEX        "Booking_packageId_idx"              ON "Booking"("packageId");
CREATE INDEX        "Booking_status_idx"                 ON "Booking"("status");
CREATE INDEX        "Booking_eventDate_idx"              ON "Booking"("eventDate");
CREATE INDEX        "Booking_providerProfileId_status_idx" ON "Booking"("providerProfileId", "status");
CREATE INDEX        "Booking_clientId_status_idx"        ON "Booking"("clientId", "status");
CREATE INDEX        "Booking_status_eventDate_idx"       ON "Booking"("status", "eventDate");

-- ProviderProfile — new indexes added in this schema revision
CREATE INDEX IF NOT EXISTS "ProviderProfile_primaryType_idx"              ON "ProviderProfile"("primaryType");
CREATE INDEX IF NOT EXISTS "ProviderProfile_isSoloWorker_idx"             ON "ProviderProfile"("isSoloWorker");
CREATE INDEX IF NOT EXISTS "ProviderProfile_serviceAreas_idx"             ON "ProviderProfile"("serviceAreas");
CREATE INDEX IF NOT EXISTS "ProviderProfile_minGuestCount_idx"            ON "ProviderProfile"("minGuestCount");
CREATE INDEX IF NOT EXISTS "ProviderProfile_maxGuestCount_idx"            ON "ProviderProfile"("maxGuestCount");
CREATE INDEX IF NOT EXISTS "ProviderProfile_averageRating_totalReviews_idx" ON "ProviderProfile"("averageRating", "totalReviews");

-- ───────────────────────────────────────────────────────────────────────────
-- PHASE 11: Foreign key constraints
-- ───────────────────────────────────────────────────────────────────────────

-- Package
ALTER TABLE "Package"
    ADD CONSTRAINT "Package_providerProfileId_fkey"
    FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- SeasonalPricingRule
ALTER TABLE "SeasonalPricingRule"
    ADD CONSTRAINT "SeasonalPricingRule_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- DayOfWeekPricingRule
ALTER TABLE "DayOfWeekPricingRule"
    ADD CONSTRAINT "DayOfWeekPricingRule_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddOn
ALTER TABLE "AddOn"
    ADD CONSTRAINT "AddOn_providerProfileId_fkey"
    FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- _PackageAddOns (both sides cascade from their parent tables)
ALTER TABLE "_PackageAddOns"
    ADD CONSTRAINT "_PackageAddOns_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Package"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_PackageAddOns"
    ADD CONSTRAINT "_PackageAddOns_B_fkey"
    FOREIGN KEY ("B") REFERENCES "AddOn"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AvailabilityBlock
ALTER TABLE "AvailabilityBlock"
    ADD CONSTRAINT "AvailabilityBlock_providerProfileId_fkey"
    FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- EventRequest
ALTER TABLE "EventRequest"
    ADD CONSTRAINT "EventRequest_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventRequest"
    ADD CONSTRAINT "EventRequest_providerProfileId_fkey"
    FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventRequest"
    ADD CONSTRAINT "EventRequest_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Quote
ALTER TABLE "Quote"
    ADD CONSTRAINT "Quote_eventRequestId_fkey"
    FOREIGN KEY ("eventRequestId") REFERENCES "EventRequest"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Quote"
    ADD CONSTRAINT "Quote_providerProfileId_fkey"
    FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quote"
    ADD CONSTRAINT "Quote_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Booking
ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_providerProfileId_fkey"
    FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking"
    ADD CONSTRAINT "Booking_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payment — restore FK to new Booking table
ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Review — restore FK to new Booking table
ALTER TABLE "Review"
    ADD CONSTRAINT "Review_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
