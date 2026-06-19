import { Transform } from 'class-transformer';

export class CreateGameDto {
  course_id?: string;
  group_id?: string;
  location?: string;
  distance?: number;
  lat?: number;
  lng?: number;
  handicap_min?: number;
  handicap_max?: number;
  date: Date;

  // Replace start_time with time_slot and exact_time
  time_slot: 'EARLY_MORNING' | 'LATE_MORNING' | 'LUNCHTIME' | 'LATE_AFTERNOON';
  exact_time?: string;

  players_needed: number;
  players_current: number;
  invited_users?: string[];
  is_booked: boolean;

  // New fields for enhanced game details
  game_type:
    | 'PURELY_SOCIAL'
    | 'RELAXED_ROUND'
    | 'COMPETITIVE_MATCH'
    | 'BEGINNER_FRIENDLY';
  game_format?:
    | 'MATCHPLAY'
    | 'STROKEPLAY'
    | 'SCRAMBLE'
    | 'STABLEFORD'
    | 'BEST_BALL'
    | 'DONT_KNOW_YET';
  organiser_handicap: 'LOW' | 'MID' | 'HIGH' | 'DONT_KNOW';

  /**
   * Accepts a float (e.g. 55.00 for £55) and converts to integer pence/cents (e.g. 5500)
   */
  @Transform(({ value }) =>
    value !== undefined ? Math.round(value * 100) : value,
  )
  total_cost?: number; // Total cost in pence/cents

  /**
   * Accepts a float (e.g. 13.50 for £13.50) and converts to integer pence/cents (e.g. 1350)
   */
  @Transform(({ value }) =>
    value !== undefined ? Math.round(value * 100) : value,
  )
  cost_per_player?: number; // Cost per player in pence/cents
}
