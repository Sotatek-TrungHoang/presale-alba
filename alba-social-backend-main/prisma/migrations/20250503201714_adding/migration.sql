/*
  Warnings:

  - A unique constraint covering the columns `[stripe_connect_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "TimeSlot" ADD VALUE 'EVENING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripe_last_event_time" TIMESTAMP(3),
ADD COLUMN     "stripe_payouts_enabled" BOOLEAN DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripe_connect_id_key" ON "User"("stripe_connect_id");
