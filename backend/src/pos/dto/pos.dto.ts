import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { DualApprovalDto } from '../../dual-control/dto/approval.dto';

export class PosSaleItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;
}

export class PosPaymentLineDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount: number;
}

export class CreatePosSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items: PosSaleItemDto[];

  /** Single-tender backward compat when `payments` is omitted */
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /** Multi-method split tender — amounts must sum to invoice total (incl. tip) */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosPaymentLineDto)
  payments?: PosPaymentLineDto[];

  /** @deprecated Ignored — tax always comes from company ftaConfig */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;

  @IsOptional()
  @IsBoolean()
  useStoreCredit?: boolean;
}

export class VoidPosSaleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

export class PosRefundItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class RefundPosSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosRefundItemDto)
  items: PosRefundItemDto[];

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;

  @IsOptional()
  @IsIn(['ORIGINAL','CASH','STORE_CREDIT'])
  refundMethod?: 'ORIGINAL'|'CASH'|'STORE_CREDIT';
}

export class OpenPosShiftDto {
  /** Preferred API name — maps to PosShift.openingFloat */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingCash?: number;

  /** @deprecated Prefer openingCash */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  openingFloat?: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ClosePosShiftDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  closingCash: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

export class CreatePosCashMovementDto {
  @IsIn(['IN', 'OUT'])
  type: 'IN' | 'OUT';

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class LinkPosDto {
  @IsString()
  key: string;
}

export class PosDraftLineDto {
  @IsUUID()
  productId: string;

  @IsString()
  name: string;

  @IsString()
  sku: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;
}

export class CreatePosDraftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PosDraftLineDto)
  lines: PosDraftLineDto[];
}

export class UpdatePosDraftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
