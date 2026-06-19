/*
  Warnings:

  - You are about to drop the column `is_booked` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `is_confirmed` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `start_time_max` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the column `start_time_min` on the `Game` table. All the data in the column will be lost.
  - The `status` column on the `GamePlayer` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `start_time` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "GameRequestStatus" AS ENUM ('OPEN', 'FULL', 'CLOSED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlayerStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "is_booked",
DROP COLUMN "is_confirmed",
DROP COLUMN "start_time_max",
DROP COLUMN "start_time_min",
ADD COLUMN     "start_time" TEXT NOT NULL,
ADD COLUMN     "status" "GameStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "GameParticipant" ADD COLUMN     "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "GamePlayer" DROP COLUMN "status",
ADD COLUMN     "status" "PlayerStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "GameRequest" ADD COLUMN     "status" "GameRequestStatus" NOT NULL DEFAULT 'OPEN';
