-- Add sharedToFeed to PortfolioPost (private-first: posts default to not shared)
ALTER TABLE "PortfolioPost" ADD COLUMN "sharedToFeed" BOOLEAN NOT NULL DEFAULT false;

-- Add vendorReply + vendorRepliedAt to PortfolioVendorTag
ALTER TABLE "PortfolioVendorTag" ADD COLUMN "vendorReply" TEXT;
ALTER TABLE "PortfolioVendorTag" ADD COLUMN "vendorRepliedAt" TIMESTAMP(3);
