-- Add PENDING_VENDOR_APPROVAL to QuoteStatus enum
-- Vendors must now explicitly approve auto-generated quotes before planners can see them

ALTER TYPE "QuoteStatus" ADD VALUE 'PENDING_VENDOR_APPROVAL' AFTER 'DRAFT';
