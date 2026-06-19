/*
  Warnings:

  - The values [PENDING,CONFIRMED] on the enum `GameStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [DECLINED] on the enum `PlayerStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `game_request_id` on the `Conversation` table. All the data in the column will be lost.
  - You are about to drop the column `original_request_id` on the `Game` table. All the data in the column will be lost.
  - You are about to drop the `GameParticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GameRequest` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[game_id]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `creator_id` to the `Game` table without a default value. This is not possible if the table is not empty.
  - Added the required column `players_current` to the `Game` table without a default value. This is not possible if the table is not empty.
  - Added the required column `players_needed` to the `Game` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GameStatus_new" AS ENUM ('PLAYERS_REQUIRED', 'APPROVAL_REQUIRED', 'CONFIRMATION_NEEDED', 'READY', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Game" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Game" ALTER COLUMN "status" TYPE "GameStatus_new" USING ("status"::text::"GameStatus_new");
ALTER TYPE "GameStatus" RENAME TO "GameStatus_old";
ALTER TYPE "GameStatus_new" RENAME TO "GameStatus";
DROP TYPE "GameStatus_old";
ALTER TABLE "Game" ALTER COLUMN "status" SET DEFAULT 'PLAYERS_REQUIRED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PlayerStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED');
ALTER TABLE "GamePlayer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "GamePlayer" ALTER COLUMN "status" TYPE "PlayerStatus_new" USING ("status"::text::"PlayerStatus_new");
ALTER TYPE "PlayerStatus" RENAME TO "PlayerStatus_old";
ALTER TYPE "PlayerStatus_new" RENAME TO "PlayerStatus";
DROP TYPE "PlayerStatus_old";
ALTER TABLE "GamePlayer" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_game_request_id_fkey";

-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT "Game_original_request_id_fkey";

-- DropForeignKey
ALTER TABLE "GameParticipant" DROP CONSTRAINT "GameParticipant_request_id_fkey";

-- DropForeignKey
ALTER TABLE "GameParticipant" DROP CONSTRAINT "GameParticipant_user_id_fkey";

-- DropForeignKey
ALTER TABLE "GameRequest" DROP CONSTRAINT "GameRequest_course_id_fkey";

-- DropForeignKey
ALTER TABLE "GameRequest" DROP CONSTRAINT "GameRequest_creator_id_fkey";

-- DropForeignKey
ALTER TABLE "GameRequest" DROP CONSTRAINT "GameRequest_group_id_fkey";

-- DropIndex
DROP INDEX "Conversation_game_request_id_idx";

-- DropIndex
DROP INDEX "Conversation_game_request_id_key";

-- DropIndex
DROP INDEX "Game_original_request_id_key";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "game_request_id",
ADD COLUMN     "game_id" TEXT;

-- AlterTable
ALTER TABLE "Game" DROP COLUMN "original_request_id",
ADD COLUMN     "creator_id" TEXT NOT NULL,
ADD COLUMN     "players_current" INTEGER NOT NULL,
ADD COLUMN     "players_needed" INTEGER NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PLAYERS_REQUIRED';

-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "has_approved" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "GameParticipant";

-- DropTable
DROP TABLE "GameRequest";

-- DropEnum
DROP TYPE "GameRequestStatus";

-- DropEnum
DROP TYPE "ParticipantStatus";

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_game_id_key" ON "Conversation"("game_id");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
