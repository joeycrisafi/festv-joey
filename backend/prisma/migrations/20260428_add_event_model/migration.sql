-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable: Event (top-level planning object grouping vendor requests)
CREATE TABLE "Event" (
    "id"         TEXT NOT NULL,
    "clientId"   TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "eventType"  "EventType" NOT NULL,
    "eventDate"  TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "notes"      TEXT,
    "status"     "EventStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- AddColumn: optional eventId on EventRequest
ALTER TABLE "EventRequest" ADD COLUMN "eventId" TEXT;

-- CreateIndex
CREATE INDEX "Event_clientId_idx" ON "Event"("clientId");
CREATE INDEX "Event_eventDate_idx" ON "Event"("eventDate");
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE INDEX "EventRequest_eventId_idx" ON "EventRequest"("eventId");

-- AddForeignKey: Event.clientId → User.id (cascade delete)
ALTER TABLE "Event" ADD CONSTRAINT "Event_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: EventRequest.eventId → Event.id (set null on delete)
ALTER TABLE "EventRequest" ADD CONSTRAINT "EventRequest_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
