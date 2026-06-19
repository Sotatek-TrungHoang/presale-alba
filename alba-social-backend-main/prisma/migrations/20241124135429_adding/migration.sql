-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'NOT_INVITED');

-- AlterTable
ALTER TABLE "GamePlayer" ADD COLUMN     "invite_status" "InviteStatus" NOT NULL DEFAULT 'NOT_INVITED';
