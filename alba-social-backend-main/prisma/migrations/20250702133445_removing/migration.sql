/*
  Warnings:

  - You are about to drop the column `title` on the `Complaint` table. All the data in the column will be lost.
  - Made the column `description` on table `Complaint` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Complaint" DROP COLUMN "title",
ALTER COLUMN "description" SET NOT NULL;
