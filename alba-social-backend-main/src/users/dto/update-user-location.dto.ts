import { IsLatitude, IsLongitude, IsNotEmpty } from 'class-validator';

export class UpdateUserLocationDto {
  @IsNotEmpty()
  @IsLatitude()
  lat: number;

  @IsNotEmpty()
  @IsLongitude()
  lng: number;
}
