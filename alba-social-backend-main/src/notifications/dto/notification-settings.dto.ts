import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  gameNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  chatNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  followNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  generalNotifications?: boolean;
}
