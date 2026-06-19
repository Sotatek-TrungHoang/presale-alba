/*
  Warnings:

  - Added the required column `tee_id` to the `Round` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "tee_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_tee_id_fkey" FOREIGN KEY ("tee_id") REFERENCES "CourseTee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
