import { HandicapRange, PlayerType, GameType } from '@prisma/client';

export class UserOnboardingDto {
  handicapRange: HandicapRange;
  playerType: PlayerType;
  preferences: GameType[];
  homeCourses: string[]; // Array of course IDs
  availability: {
    weekdays?: string[]; // Array of TimeSlot values
    weekends?: string[]; // Array of TimeSlot values
  };
}
