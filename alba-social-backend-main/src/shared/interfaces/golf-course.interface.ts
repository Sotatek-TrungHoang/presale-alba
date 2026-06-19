export interface GolfCourse {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  address?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}
