/*
  Warnings:

  - You are about to drop the column `stripe_connect_id` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_last_event_time` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `stripe_payouts_enabled` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_stripe_connect_id_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "stripe_connect_id",
DROP COLUMN "stripe_last_event_time",
DROP COLUMN "stripe_payouts_enabled";
