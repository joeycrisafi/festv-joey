-- Fix _PackageAddOns implicit M2M join table FK column mapping.
--
-- Prisma assigns A/B alphabetically by model name:
--   A → AddOn   (AddOn < Package)
--   B → Package
--
-- The original migration had them reversed (A → Package, B → AddOn).
-- This caused every applicablePackages connect to fail with P2003.

-- Drop the wrong FKs
ALTER TABLE "_PackageAddOns" DROP CONSTRAINT IF EXISTS "_PackageAddOns_A_fkey";
ALTER TABLE "_PackageAddOns" DROP CONSTRAINT IF EXISTS "_PackageAddOns_B_fkey";

-- Recreate with correct mapping: A = AddOn.id, B = Package.id
ALTER TABLE "_PackageAddOns"
    ADD CONSTRAINT "_PackageAddOns_A_fkey"
    FOREIGN KEY ("A") REFERENCES "AddOn"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_PackageAddOns"
    ADD CONSTRAINT "_PackageAddOns_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Package"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
