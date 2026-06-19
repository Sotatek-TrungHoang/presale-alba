import { IsString } from 'class-validator';

export class JoinLeaveGroupDto {
  @IsString()
  groupId: string;
}
