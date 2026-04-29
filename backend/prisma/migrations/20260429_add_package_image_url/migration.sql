-- Add imageUrl to Package for Cloudinary-hosted package hero images
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
