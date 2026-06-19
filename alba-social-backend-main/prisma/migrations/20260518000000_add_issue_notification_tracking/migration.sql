-- AlterTable
ALTER TABLE "StripeAccount" ADD COLUMN "details_submitted_at" TIMESTAMP(3);
ALTER TABLE "StripeAccount" ADD COLUMN "issue_notified_at" TIMESTAMP(3);

-- Backfill details_submitted_at for existing accounts that have already
-- submitted details, so their delay window is treated as elapsed.
UPDATE "StripeAccount"
SET "details_submitted_at" = COALESCE("last_event_time", "created_at")
WHERE "details_submitted" = true AND "details_submitted_at" IS NULL;
