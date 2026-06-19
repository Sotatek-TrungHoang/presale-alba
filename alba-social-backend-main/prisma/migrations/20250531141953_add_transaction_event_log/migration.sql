-- CreateTable
CREATE TABLE "TransactionEventLog" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "stripe_event_type" TEXT NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "details" JSONB,
    "notes" TEXT,
    "stripe_event_created_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "TransactionEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionEventLog_stripe_event_id_key" ON "TransactionEventLog"("stripe_event_id");

-- AddForeignKey
ALTER TABLE "TransactionEventLog" ADD CONSTRAINT "TransactionEventLog_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
