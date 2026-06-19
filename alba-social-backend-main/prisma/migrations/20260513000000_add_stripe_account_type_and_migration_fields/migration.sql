-- CreateEnum
CREATE TYPE "StripeAccountType" AS ENUM ('EXPRESS', 'CUSTOM');

-- AlterTable
ALTER TABLE "StripeAccount" ADD COLUMN     "account_type" "StripeAccountType" NOT NULL DEFAULT 'EXPRESS',
ADD COLUMN     "migrated_at" TIMESTAMP(3),
ADD COLUMN     "previous_account_type" "StripeAccountType",
ADD COLUMN     "previous_connect_id" TEXT;
