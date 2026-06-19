import { IsIn, IsString } from 'class-validator';

export class UpdatePlayerStatusDto {
  @IsString()
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';
}
