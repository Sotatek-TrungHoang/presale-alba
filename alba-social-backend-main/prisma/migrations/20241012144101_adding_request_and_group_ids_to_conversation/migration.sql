/*
  Warnings:

  - A unique constraint covering the columns `[game_request_id]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[group_id]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "ConversationType" ADD VALUE 'GAME';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "game_request_id" TEXT,
ADD COLUMN     "group_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_game_request_id_key" ON "Conversation"("game_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_group_id_key" ON "Conversation"("group_id");

-- CreateIndex
CREATE INDEX "Conversation_game_request_id_idx" ON "Conversation"("game_request_id");

-- CreateIndex
CREATE INDEX "Conversation_group_id_idx" ON "Conversation"("group_id");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_game_request_id_fkey" FOREIGN KEY ("game_request_id") REFERENCES "GameRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
