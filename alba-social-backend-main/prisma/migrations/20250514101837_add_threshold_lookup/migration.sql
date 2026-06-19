-- CreateTable
CREATE TABLE "CoursePriceThreshold" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "lower_bound" INTEGER NOT NULL,
    "upper_bound" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CoursePriceThreshold_pkey" PRIMARY KEY ("id")
);
