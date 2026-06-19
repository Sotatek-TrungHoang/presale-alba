/*
  Warnings:

  - You are about to drop the column `start_time` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the `Availability` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `game_type` to the `Game` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organiser_handicap` to the `Game` table without a default value. This is not possible if the table is not empty.
  - Added the required column `time_slot` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'FULLY_PAID', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HandicapRange" AS ENUM ('LOW', 'MID', 'HIGH', 'DONT_KNOW');

-- CreateEnum
CREATE TYPE "PlayerType" AS ENUM ('CASUAL_PLAYER', 'DEDICATED_IMPROVER', 'SERIOUS_COMPETITOR', 'NEW_TO_GOLF');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('PURELY_SOCIAL', 'RELAXED_ROUND', 'COMPETITIVE_MATCH', 'BEGINNER_FRIENDLY');

-- CreateEnum
CREATE TYPE "TimeSlot" AS ENUM ('EARLY_MORNING', 'LATE_MORNING', 'LUNCHTIME', 'LATE_AFTERNOON');

-- CreateEnum
CREATE TYPE "GameFormat" AS ENUM ('MATCHPLAY', 'STROKEPLAY', 'SCRAMBLE', 'STABLEFORD', 'BEST_BALL', 'DONT_KNOW_YET');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('WEEKDAY', 'WEEKEND');

-- DropForeignKey
ALTER TABLE "Availability" DROP CONSTRAINT "Availability_profile_id_fkey";

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "start_time",
ADD COLUMN     "cost_per_player" INTEGER,
ADD COLUMN     "exact_time" TEXT,
ADD COLUMN     "game_format" "GameFormat",
ADD COLUMN     "game_type" "GameType" NOT NULL,
ADD COLUMN     "organiser_handicap" "HandicapRange" NOT NULL,
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "payout_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payout_date" TIMESTAMP(3),
ADD COLUMN     "stripe_session_id" TEXT,
ADD COLUMN     "time_slot" "TimeSlot" NOT NULL,
ADD COLUMN     "total_cost" INTEGER;

-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "has_paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payment_amount" INTEGER,
ADD COLUMN     "payment_date" TIMESTAMP(3),
ADD COLUMN     "refund_date" TIMESTAMP(3),
ADD COLUMN     "refunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripe_payment_id" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripe_connect_id" TEXT;

-- DropTable
DROP TABLE "Availability";

-- CreateTable
CREATE TABLE "UserOnboarding" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "handicap_range" "HandicapRange" NOT NULL,
    "player_type" "PlayerType" NOT NULL,
    "preferences" "GameType"[],
    "onboarding_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "UserOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAvailability" (
    "id" TEXT NOT NULL,
    "onboarding_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "UserAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTimeSlot" (
    "id" TEXT NOT NULL,
    "availability_id" TEXT NOT NULL,
    "day_type" "DayType" NOT NULL,
    "time_slot" "TimeSlot" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "UserTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserOnboarding_user_id_key" ON "UserOnboarding"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserAvailability_onboarding_id_key" ON "UserAvailability"("onboarding_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserTimeSlot_availability_id_day_type_time_slot_key" ON "UserTimeSlot"("availability_id", "day_type", "time_slot");

-- AddForeignKey
ALTER TABLE "UserOnboarding" ADD CONSTRAINT "UserOnboarding_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAvailability" ADD CONSTRAINT "UserAvailability_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "UserOnboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTimeSlot" ADD CONSTRAINT "UserTimeSlot_weekday_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "UserAvailability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTimeSlot" ADD CONSTRAINT "UserTimeSlot_weekend_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "UserAvailability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
