import { Transform } from 'class-transformer';

export class UpdateGameStatusDto {
  course_id?: string;
  date?: Date;

  // Replace start_time with time_slot and exact_time
  time_slot?: 'EARLY_MORNING' | 'LATE_MORNING' | 'LUNCHTIME' | 'LATE_AFTERNOON';
  exact_time?: string;

  /**
   * Accepts a float (e.g. 55.00 for £55) and converts to integer pence/cents (e.g. 5500)
   */
  @Transform(({ value }) =>
    value !== undefined ? Math.round(value * 100) : value,
  )
  total_cost?: number;

  /**
   * Accepts a float (e.g. 13.50 for £13.50) and converts to integer pence/cents (e.g. 1350)
   */
  @Transform(({ value }) =>
    value !== undefined ? Math.round(value * 100) : value,
  )
  cost_per_player?: number;
}
