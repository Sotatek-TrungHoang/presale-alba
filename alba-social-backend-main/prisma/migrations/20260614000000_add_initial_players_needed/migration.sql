-- AlterTable: add initial_players_needed, backfilling existing games from players_needed
ALTER TABLE "Game" ADD COLUMN "initial_players_needed" INTEGER;

-- Backfill: all existing games get initial_players_needed = players_needed
UPDATE "Game" SET "initial_players_needed" = "players_needed";

-- Enforce NOT NULL now that every row has a value
ALTER TABLE "Game" ALTER COLUMN "initial_players_needed" SET NOT NULL;
