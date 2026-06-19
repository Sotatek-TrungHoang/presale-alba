export class ConfirmGameDto {
  course_id?: string;
  date?: Date;
  time_slot?: 'EARLY_MORNING' | 'LATE_MORNING' | 'LUNCHTIME' | 'LATE_AFTERNOON';
  exact_time?: string;
}
