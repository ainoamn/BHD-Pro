import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
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

  /**
   * When true: create an unpaid POS invoice and let the cashier open partner
   * gateway checkout (Thawani/Stripe/PayPal). Not NFC badge dual-control.
   */
  @IsOptional()
  @IsBoolean()
  partnerCheckout?: boolean;

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

  /** Tip recipient user id (resto tip pool attribution) */
  @IsOptional()
  @IsUUID()
  tipAssigneeId?: string;

  /** Tax-free service charge line (separate from tip) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceChargeAmount?: number;

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

  /**
   * Allow selling past on-hand for tracked items (manager dual-control:
   * POS_STOCK_OVERRIDE). Stock goes negative; movement notes tagged.
   */
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsBoolean()
  useStoreCredit?: boolean;

  /** Loyalty points to redeem as cart discount (requires customer + redeemEnabled) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  loyaltyPointsToRedeem?: number;

  /**
   * Client-generated UUID for offline queue idempotency.
   * Re-submitting the same id returns the existing POS invoice instead of duplicating.
   */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  clientSaleId?: string;

  /**
   * When recalling a parked cart that had a cash/card hold, pass the draft id
   * so the hold is applied to the sale and the draft is consumed.
   */
  @IsOptional()
  @IsUUID()
  parkedDraftId?: string;
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

  /** Required for cash OUT (GL expense posting). Optional for IN. */
  @ValidateIf((o: CreatePosCashMovementDto) => o.type === 'OUT')
  @IsNotEmpty({ message: 'Reason is required for cash out' })
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

/** Audited drawer open without a sale (amount 0, type NO_SALE). */
export class CreatePosNoSaleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

export class LinkPosDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class SetPosWarehouseDto {
  @IsUUID()
  warehouseId: string;
}

export class ActivatePosLinkDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
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

  /** Deposit taken while parking (CASH posts drawer IN) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  heldAmount?: number;

  @IsOptional()
  @IsIn(['CASH', 'CREDIT_CARD', 'BANK_TRANSFER'])
  heldMethod?: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER';
}

export class DeletePosDraftDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

export class PosStoreCreditTopUpDto {
  @IsUUID()
  contactId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount: number;

  @IsIn(['CASH', 'CREDIT_CARD', 'BANK_TRANSFER'])
  method: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER';

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsUUID()
  bankAccountId?: string;
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

export class CashierBonusTierDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSales: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  bonusAmount: number;
}

export class UpdateIncentivesConfigDto {
  @IsOptional()
  @IsBoolean()
  cashierEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cashierPercent?: number;

  @IsOptional()
  @IsBoolean()
  customerEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customerPointsPerUnit?: number;

  @IsOptional()
  @IsBoolean()
  redeemEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  redeemPointsPerUnit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  receiptFooter?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CashierBonusTierDto)
  cashierBonusTiers?: CashierBonusTierDto[];
}

export class PayoutCommissionDto {
  @IsUUID()
  userId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** When true (default), also record PosCashMovement OUT on the open shift drawer. */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    return value;
  })
  @IsBoolean()
  deductFromDrawer?: boolean;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class UpdatePosFavoritesDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  productIds: string[];
}
