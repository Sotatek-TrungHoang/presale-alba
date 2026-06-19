/*
  Warnings:

  - A unique constraint covering the columns `[stripe_application_fee_refund_id]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripe_payment_intent_id,type]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "stripe_application_fee_refund_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_application_fee_refund_id_key" ON "Transaction"("stripe_application_fee_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_payment_intent_id_type_key" ON "Transaction"("stripe_payment_intent_id", "type");
