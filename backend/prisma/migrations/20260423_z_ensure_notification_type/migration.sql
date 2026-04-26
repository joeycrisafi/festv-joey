-- Ensure NotificationType enum exists before 20260424 tries to ADD VALUE to it.
-- Root cause: if this type is missing in the DB (e.g. after a DB reset or
-- a failed transaction in an earlier migration), 20260424's ALTER TYPE will
-- error with "type notificationtype does not exist".
-- This migration is idempotent — safe to run in any DB state.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationType') THEN
    -- Type is completely absent — create it with all current values
    CREATE TYPE "NotificationType" AS ENUM (
      'NEW_REQUEST',
      'NEW_QUOTE',
      'QUOTE_ACCEPTED',
      'QUOTE_REJECTED',
      'BOOKING_CONFIRMED',
      'BOOKING_CANCELLED',
      'PAYMENT_RECEIVED',
      'PAYMENT_FAILED',
      'NEW_MESSAGE',
      'NEW_REVIEW',
      'REMINDER',
      'SYSTEM'
    );
  ELSE
    -- Type exists — backfill any values that may be missing
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_REQUEST';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_QUOTE';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUOTE_ACCEPTED';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUOTE_REJECTED';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CONFIRMED';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BOOKING_CANCELLED';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIVED';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_MESSAGE';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_REVIEW';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REMINDER';
    ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM';
  END IF;
END
$$;

-- Also ensure the Notification table exists (depends on NotificationType above)
CREATE TABLE IF NOT EXISTS "Notification" (
    "id"        TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "type"      "NotificationType" NOT NULL,
    "title"     TEXT        NOT NULL,
    "message"   TEXT        NOT NULL,
    "data"      JSONB,
    "isRead"    BOOLEAN     NOT NULL DEFAULT false,
    "readAt"    TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_userId_idx"   ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_isRead_idx"   ON "Notification"("isRead");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt");
