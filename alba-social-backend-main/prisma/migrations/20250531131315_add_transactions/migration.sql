-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT_INTENT_CHARGE', 'APPLICATION_FEE', 'TRANSFER', 'PAYOUT', 'REFUND', 'REFUND_REVERSAL', 'PLATFORM_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'PROCESSING', 'CANCELED', 'REQUIRES_ACTION', 'REQUIRES_CAPTURE');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT,
    "user_id" TEXT,
    "game_id" TEXT,
    "game_player_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "stripe_charge_id" TEXT,
    "stripe_refund_id" TEXT,
    "stripe_payout_id" TEXT,
    "stripe_transfer_id" TEXT,
    "stripe_balance_transaction_id" TEXT,
    "stripe_application_fee_id" TEXT,
    "stripe_customer_id" TEXT,
    "stripe_connected_account_id" TEXT,
    "related_stripe_object_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_refund_id_key" ON "Transaction"("stripe_refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_payout_id_key" ON "Transaction"("stripe_payout_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_balance_transaction_id_key" ON "Transaction"("stripe_balance_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_stripe_application_fee_id_key" ON "Transaction"("stripe_application_fee_id");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_game_player_id_fkey" FOREIGN KEY ("game_player_id") REFERENCES "GamePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
