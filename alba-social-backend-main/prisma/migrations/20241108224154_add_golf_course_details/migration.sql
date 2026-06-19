-- CreateTable
CREATE TABLE "TeeName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "TeeName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseTee" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "tee_name_id" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "slope" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CourseTee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseHole" (
    "id" TEXT NOT NULL,
    "tee_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "yards" INTEGER NOT NULL,
    "par" INTEGER NOT NULL,
    "handicap" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "CourseHole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeeName_name_key" ON "TeeName"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CourseTee_course_id_tee_name_id_key" ON "CourseTee"("course_id", "tee_name_id");

-- CreateIndex
CREATE UNIQUE INDEX "CourseHole_tee_id_number_key" ON "CourseHole"("tee_id", "number");

-- AddForeignKey
ALTER TABLE "CourseTee" ADD CONSTRAINT "CourseTee_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "GolfCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseTee" ADD CONSTRAINT "CourseTee_tee_name_id_fkey" FOREIGN KEY ("tee_name_id") REFERENCES "TeeName"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseHole" ADD CONSTRAINT "CourseHole_tee_id_fkey" FOREIGN KEY ("tee_id") REFERENCES "CourseTee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
