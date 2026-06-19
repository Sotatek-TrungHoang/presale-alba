/*
  Warnings:

  - You are about to drop the column `tee_name_id` on the `CourseTee` table. All the data in the column will be lost.
  - You are about to drop the `TeeName` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[course_id,tee_name]` on the table `CourseTee` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "CourseTee" ADD COLUMN "tee_name" TEXT;

-- Backfill tee_name from TeeName
UPDATE "CourseTee" ct
SET "tee_name" = tn."name"
FROM "TeeName" tn
WHERE ct."tee_name_id" = tn."id";

-- Enforce not-null after backfill
ALTER TABLE "CourseTee" ALTER COLUMN "tee_name" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "CourseTee" DROP CONSTRAINT "CourseTee_tee_name_id_fkey";

-- DropIndex
DROP INDEX "CourseTee_course_id_tee_name_id_key";

-- AlterTable
ALTER TABLE "CourseTee" DROP COLUMN "tee_name_id";

-- DropTable
DROP TABLE "TeeName";

-- CreateIndex
CREATE UNIQUE INDEX "CourseTee_course_id_tee_name_key" ON "CourseTee"("course_id", "tee_name");
