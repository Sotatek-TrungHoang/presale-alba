-- CreateTable
CREATE TABLE "Attribution" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "first_touch" JSONB,
    "last_touch" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attribution_user_id_idx" ON "Attribution"("user_id");

-- AddForeignKey
ALTER TABLE "Attribution" ADD CONSTRAINT "Attribution_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

