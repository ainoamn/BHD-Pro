import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
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
  'NFC',
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

  /** Raw NFC badge UID/text — compared to bcrypt hashes; never stored */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  badgeSecret?: string;

  /** Free-text reason required for dual-control audit trail (min 3 chars) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason?: string;
}

export const DUAL_CONTROL_ACTIONS = [
  'POS_VOID',
  'POS_PRICE_OVERRIDE',
  'POS_LINE_DISCOUNT',
  'POS_STOCK_OVERRIDE',
  'POS_NO_SALE',
  'POS_REFUND',
  'POS_BLIND_RETURN',
  'POS_IDLE_UNLOCK',
  'STOCK_ADJUST',
  'STOCK_TRANSFER',
  'INVOICE_CANCEL',
  'PAYMENT_REVERSE',
  'SHIFT_CLOSE_VARIANCE',
  'SHIFT_CASH_OUT',
  'PAYROLL_PAY',
  'CLAIM_PAY',
  'BANK_INTERNAL_TRANSFER',
  'RESTO_VOID',
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
  POS_LINE_DISCOUNT?: boolean;

  @IsOptional()
  @IsBoolean()
  POS_STOCK_OVERRIDE?: boolean;

  @IsOptional()
  @IsBoolean()
  POS_NO_SALE?: boolean;

  @IsOptional()
  @IsBoolean()
  POS_REFUND?: boolean;

  @IsOptional()
  @IsBoolean()
  POS_BLIND_RETURN?: boolean;

  @IsOptional()
  @IsBoolean()
  POS_IDLE_UNLOCK?: boolean;

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

  @IsOptional()
  @IsBoolean()
  SHIFT_CLOSE_VARIANCE?: boolean;

  @IsOptional()
  @IsBoolean()
  SHIFT_CASH_OUT?: boolean;

  @IsOptional()
  @IsBoolean()
  PAYROLL_PAY?: boolean;

  @IsOptional()
  @IsBoolean()
  CLAIM_PAY?: boolean;

  @IsOptional()
  @IsBoolean()
  BANK_INTERNAL_TRANSFER?: boolean;

  @IsOptional()
  @IsBoolean()
  RESTO_VOID?: boolean;
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

  /** Raw NFC badge secret — hashed and appended to nfcBadgeHashes (never stored raw) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  addNfcBadgeSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  clearNfcBadges?: boolean;

  /** Max |closingCash − expectedCash| in company currency before SHIFT_CLOSE_VARIANCE (default 1.000) */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shiftVarianceLimit?: number;

  /** Cash-out amount that triggers SHIFT_CASH_OUT dual-control (default 20) */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashOutApprovalLimit?: number;

  /** When true, block POS sales without an open shift (default false) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requireOpenShift?: boolean;

  /** When true, require TOTP 2FA for ADMIN/MANAGER (company opt-in) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  require2faForAdmins?: boolean;

  /** Idle minutes before POS locks (0 = off) */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  idleLockMinutes?: number;

  /** Allow cashiers to enable training mode (default true) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  allowTrainingMode?: boolean;

  /** Auto-send POS receipt WhatsApp to customer phone (default true when WA configured) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSendPosReceipts?: boolean;

  /** Auto-send POS receipt email when customer has email (default true when email configured) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSendPosReceiptEmail?: boolean;

  /** Auto-send POS receipt SMS via Twilio (default true when SMS configured) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSendPosReceiptSms?: boolean;

  /** Auto-email Z-report to managers when a shift closes (default false) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoEmailZReportOnClose?: boolean;

  /** Alert managers when today's POS void count exceeds this (default 3) */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  voidAlertThreshold?: number;

  /** Enable live void-threshold alerts on POS shell (default true) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  voidAlertEnabled?: boolean;

  /** Absolute max line discount before POS_LINE_DISCOUNT approval (default 5) */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxLineDiscountAmount?: number;

  /** Max line discount as % of line gross before approval (default 20) */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxLineDiscountPercent?: number;

  /** Manager emails that receive Z-report on shift close */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  zReportNotifyEmails?: string[];
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
