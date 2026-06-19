-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'RESOLVED', 'REFUNDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ComplaintType" AS ENUM ('ORGANISER_DID_NOT_BOOK', 'GAME_CANCELLED_WITHOUT_NOTICE', 'OTHER');

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "complainant_id" TEXT NOT NULL,
    "type" "ComplaintType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by" TEXT,
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Complaint_game_id_idx" ON "Complaint"("game_id");

-- CreateIndex
CREATE INDEX "Complaint_complainant_id_idx" ON "Complaint"("complainant_id");

-- CreateIndex
CREATE INDEX "Complaint_resolved_by_idx" ON "Complaint"("resolved_by");

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_complainant_id_fkey" FOREIGN KEY ("complainant_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
