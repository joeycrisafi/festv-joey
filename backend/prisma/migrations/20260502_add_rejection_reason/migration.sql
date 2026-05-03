-- Add rejectionReason to Quote (optional, text field for client to explain why they declined)
ALTER TABLE "Quote" ADD COLUMN "rejectionReason" TEXT;
