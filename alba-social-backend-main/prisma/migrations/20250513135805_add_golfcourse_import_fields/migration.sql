-- AlterTable
ALTER TABLE "GolfCourse" ADD COLUMN     "booking_url" TEXT,
ADD COLUMN     "closed_down" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_bookable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "saturday_9am_cost_pence" INTEGER,
ALTER COLUMN "updated_at" DROP DEFAULT;
