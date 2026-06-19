-- AlterTable
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "address",
ADD COLUMN "address_line_1" TEXT,
ADD COLUMN "address_line_2" TEXT,
ADD COLUMN "postcode" TEXT,
ADD COLUMN "country" TEXT DEFAULT 'GB';
