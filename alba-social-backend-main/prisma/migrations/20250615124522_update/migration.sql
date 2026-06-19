-- RenameForeignKey
ALTER TABLE "UserTimeSlot" RENAME CONSTRAINT "UserTimeSlot_weekday_availability_id_fkey" TO "UserTimeSlot_availability_id_fkey";
