import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const DUAL_APPROVAL_METHODS = [
  'SELF_CONFIRM',
  'PASSWORD',
  'PIN',
  'APPROVAL_REQUEST',
  'WHATSAPP_OTP',
] as const;
export type DualApprovalMethod = (typeof DUAL_APPROVAL_METHODS)[number];

export class DualApprovalDto {
  @ApiProperty({ enum: DUAL_APPROVAL_METHODS })
  @IsIn(DUAL_APPROVAL_METHODS)
  method: DualApprovalMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pin?: string;

  /** Consumed when method is APPROVAL_REQUEST (async online manager approve). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approvalRequestId?: string;

  /** 6-digit code when method is WHATSAPP_OTP */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  otp?: string;
}

export const DUAL_CONTROL_ACTIONS = [
  'POS_VOID',
  'POS_PRICE_OVERRIDE',
  'POS_REFUND',
  'STOCK_ADJUST',
  'STOCK_TRANSFER',
  'INVOICE_CANCEL',
  'PAYMENT_REVERSE',
] as const;
export type DualControlAction = (typeof DUAL_CONTROL_ACTIONS)[number];

export class DualControlActionsDto {
  @IsOptional()
  @IsBoolean()
  POS_VOID?: boolean;

  @IsOptional()
  @IsBoolean()
  POS_PRICE_OVERRIDE?: boolean;

  @IsOptional()
  @IsBoolean()
  POS_REFUND?: boolean;

  @IsOptional()
  @IsBoolean()
  STOCK_ADJUST?: boolean;

  @IsOptional()
  @IsBoolean()
  STOCK_TRANSFER?: boolean;

  @IsOptional()
  @IsBoolean()
  INVOICE_CANCEL?: boolean;

  @IsOptional()
  @IsBoolean()
  PAYMENT_REVERSE?: boolean;
}

export class UpdateSecurityConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  dualControlEnabled?: boolean;

  @ApiPropertyOptional({ type: DualControlActionsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DualControlActionsDto)
  actions?: DualControlActionsDto;

  /** Plain PIN 4–8 digits — hashed server-side */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(8)
  @Matches(/^\d{4,8}$/, { message: 'Supervisor PIN must be 4–8 digits' })
  supervisorPin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clearSupervisorPin?: boolean;

  /** E.164-ish phone numbers that receive WhatsApp OTP (digits with country code) */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  whatsappNotifyPhones?: string[];
}

export class CreateApprovalRequestDto {
  @ApiProperty({ enum: DUAL_CONTROL_ACTIONS })
  @IsIn(DUAL_CONTROL_ACTIONS)
  action: DualControlAction;

  @ApiPropertyOptional({ description: 'Opaque client context e.g. { invoiceId }' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;
}

export class DecideApprovalRequestDto {
  @ApiProperty()
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RequestWhatsappOtpDto {
  @ApiProperty({ enum: DUAL_CONTROL_ACTIONS })
  @IsIn(DUAL_CONTROL_ACTIONS)
  action: DualControlAction;
}
