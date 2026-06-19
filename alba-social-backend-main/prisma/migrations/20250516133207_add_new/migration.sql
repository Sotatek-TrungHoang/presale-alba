/*
  Warnings:

  - The values [APPROVAL_REQUIRED,CONFIRMATION_NEEDED] on the enum `GameStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [CONFIRMED] on the enum `PlayerStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GameStatus_new" AS ENUM ('PLAYERS_REQUIRED', 'READY_TO_BOOK', 'READY', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Game" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Game" ALTER COLUMN "status" TYPE "GameStatus_new" USING ("status"::text::"GameStatus_new");
ALTER TYPE "GameStatus" RENAME TO "GameStatus_old";
ALTER TYPE "GameStatus_new" RENAME TO "GameStatus";
DROP TYPE "GameStatus_old";
ALTER TABLE "Game" ALTER COLUMN "status" SET DEFAULT 'PLAYERS_REQUIRED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PlayerStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'INVITED');
ALTER TABLE "GamePlayer" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "GamePlayer" ALTER COLUMN "status" TYPE "PlayerStatus_new" USING ("status"::text::"PlayerStatus_new");
ALTER TYPE "PlayerStatus" RENAME TO "PlayerStatus_old";
ALTER TYPE "PlayerStatus_new" RENAME TO "PlayerStatus";
DROP TYPE "PlayerStatus_old";
ALTER TABLE "GamePlayer" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;
