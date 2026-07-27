import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const FREQUENCIES = ['HOURLY', 'EVERY_2_HOURS', 'HALF_DAY', 'END_OF_DAY'] as const;
const CHANNELS = ['inApp', 'email', 'whatsapp'] as const;

export class ManagerReportChannelsDto {
  @IsBoolean()
  inApp: boolean;

  @IsBoolean()
  email: boolean;

  @IsBoolean()
  whatsapp: boolean;
}

export class UpsertManagerReportSubscriptionDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  userId: string;

  @IsIn(FREQUENCIES)
  frequency: (typeof FREQUENCIES)[number];

  @ValidateNested()
  @Type(() => ManagerReportChannelsDto)
  channels: ManagerReportChannelsDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SaveManagerReportSubscriptionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertManagerReportSubscriptionDto)
  subscriptions: UpsertManagerReportSubscriptionDto[];
}

export class SendManagerReportNowDto {
  @IsOptional()
  @IsString()
  userId?: string;
}

export { CHANNELS, FREQUENCIES };
