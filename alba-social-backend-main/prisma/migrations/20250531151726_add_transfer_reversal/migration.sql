/*
  Warnings:

  - The values [REFUND_REVERSAL] on the enum `TransactionType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[stripe_transfer_reversal_id]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "TransactionType_new" AS ENUM ('PAYMENT_INTENT_CHARGE', 'APPLICATION_FEE', 'APPLICATION_FEE_REFUND', 'TRANSFER', 'PAYOUT', 'REFUND', 'TRANSFER_REVERSAL', 'PLATFORM_ADJUSTMENT');
ALTER TABLE "Transaction" ALTER COLUMN "type" TYPE "TransactionType_new" USING ("type"::text::"TransactionType_new");
ALTER TYPE "TransactionType" RENAME TO "TransactionType_old";
ALTER TYPE "TransactionType_new" RENAME TO "TransactionType";
DROP TYPE "TransactionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "stripe_transfer_reversal_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_transfer_reversal_id_key" ON "Transaction"("stripe_transfer_reversal_id");
