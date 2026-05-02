-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('VENDOR_POST', 'PLANNER_POST');

-- CreateTable
CREATE TABLE "PortfolioPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "PostType" NOT NULL,
    "caption" TEXT,
    "imageUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packageId" TEXT,
    "addOnIds" TEXT[],
    "eventId" TEXT,

    CONSTRAINT "PortfolioPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioVendorTag" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,

    CONSTRAINT "PortfolioVendorTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioLike" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioLike_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateTable
CREATE TABLE "PortfolioSave" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSave_pkey" PRIMARY KEY ("userId","postId")
);

-- CreateIndex
CREATE INDEX "PortfolioPost_authorId_idx" ON "PortfolioPost"("authorId");
CREATE INDEX "PortfolioPost_type_idx" ON "PortfolioPost"("type");
CREATE INDEX "PortfolioPost_createdAt_idx" ON "PortfolioPost"("createdAt");
CREATE INDEX "PortfolioVendorTag_postId_idx" ON "PortfolioVendorTag"("postId");
CREATE INDEX "PortfolioVendorTag_providerId_idx" ON "PortfolioVendorTag"("providerId");

-- AddForeignKey
ALTER TABLE "PortfolioPost" ADD CONSTRAINT "PortfolioPost_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioPost" ADD CONSTRAINT "PortfolioPost_packageId_fkey"
    FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PortfolioPost" ADD CONSTRAINT "PortfolioPost_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PortfolioVendorTag" ADD CONSTRAINT "PortfolioVendorTag_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "PortfolioPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioVendorTag" ADD CONSTRAINT "PortfolioVendorTag_providerId_fkey"
    FOREIGN KEY ("providerId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PortfolioLike" ADD CONSTRAINT "PortfolioLike_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "PortfolioPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PortfolioSave" ADD CONSTRAINT "PortfolioSave_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "PortfolioPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
