-- Add NEW_REQUEST to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_REQUEST';

-- Add targetedProviderProfileId to EventRequest
ALTER TABLE "EventRequest" ADD COLUMN IF NOT EXISTS "targetedProviderProfileId" TEXT;
