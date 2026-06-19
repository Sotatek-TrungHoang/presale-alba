/*
  Warnings:

  - Changed the type of `scores` on the `PlayerScore` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "PlayerScore" DROP COLUMN "scores",
ADD COLUMN     "scores" JSONB NOT NULL;
