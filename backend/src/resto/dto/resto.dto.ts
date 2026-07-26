import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, RestoOrderChannel } from '@prisma/client';
import { DualApprovalDto } from '../../dual-control/dto/approval.dto';

/** EU14-style allergen codes used on resto menu / guest filter */
export const RESTO_ALLERGEN_CODES = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;

/** Structured dietary / lifestyle tags */
export const RESTO_DIETARY_TAGS = [
  'halal',
  'vegan',
  'vegetarian',
  'gluten_free',
  'dairy_free',
  'spicy',
  'nuts_free',
  'keto',
  'organic',
] as const;

/** Day-part menu windows — empty on product = all day */
export const RESTO_DAY_PARTS = [
  'breakfast',
  'lunch',
  'dinner',
  'late',
] as const;

export class LinkRestoDto {
  @IsString()
  key: string;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class SetRestoWarehouseDto {
  @IsUUID()
  warehouseId: string;
}

export class ActivateRestoLinkDto {
  @IsOptional()
  @IsUUID()
  warehouseId?: string;
}

export class CreateRestoZoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameEn?: string;
}

export class CreateRestoTableDto {
  @IsUUID()
  zoneId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  seats?: number;
}

export class SeedRestoFloorDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  tableCount?: number;
}

export class OpenRestoOrderDto {
  /** Required for DINE_IN; omit for TAKEAWAY / DELIVERY */
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsEnum(RestoOrderChannel)
  channel?: RestoOrderChannel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  guests?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryAddress?: string;
}

export class RestoModifierChoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-999)
  @Max(999)
  priceDelta?: number;
}

export class AddRestoOrderItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0.001)
  @Max(999)
  qty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @IsUUID()
  stationId?: string;

  /** Selected modifiers — bump unit price and append to line name/notes */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RestoModifierChoiceDto)
  modifiers?: RestoModifierChoiceDto[];

  /** 0=drinks · 1=starter · 2=main · 3=dessert */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  course?: number;

  @IsOptional()
  @IsIn(['STAFF', 'GUEST'])
  source?: 'STAFF' | 'GUEST';

  /** 1..order.guests; omit/null = shared */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  seat?: number | null;
}

export class FireRestoCourseDto {
  /** Fire only this course; omit = all pending */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  course?: number;
}

export class CreateRestoWaitlistDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  guestName: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  guests?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  quotedMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateRestoWaitlistStatusDto {
  @IsIn(['WAITING', 'NOTIFIED', 'SEATED', 'CANCELLED', 'NO_SHOW'])
  status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';

  @IsOptional()
  @IsUUID()
  tableId?: string;
}

export class NotifyRestoReservationDto {
  @IsOptional()
  @IsIn(['CONFIRM', 'REMINDER', 'TABLE_READY'])
  kind?: 'CONFIRM' | 'REMINDER' | 'TABLE_READY';
}

export class SetRestoMenu86Dto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class TransferRestoOrderDto {
  @IsUUID()
  tableId: string;
}

export class MergeRestoOrderDto {
  @IsUUID()
  targetOrderId: string;
}

export class SplitRestoOrderDto {
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds: string[];

  /** Optional target table (must be free). Omit → new TAKEAWAY check. */
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  guests?: number;
}

export class CreateRestoModifierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameEn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-999)
  @Max(999)
  priceDelta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateRestoStationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nameEn?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateRestoOrderItemDto {
  @IsOptional()
  @Type(() => Number)
  @Min(0.001)
  @Max(999)
  qty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  course?: number;

  /** 1..order.guests; null clears to shared */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  seat?: number | null;
}

export class UpdateRestoOrderDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  guests?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryAddress?: string;

  /** Tip pool assignee while order is open */
  @IsOptional()
  @IsUUID()
  tipAssigneeId?: string | null;
}

export class VoidRestoOrderItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason: string;

  /** Complimentary — keep on check at 0 for audit, or true void cancel */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  comp?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

export class SetRestoProductAllergensDto {
  @IsArray()
  @IsIn([...RESTO_ALLERGEN_CODES], { each: true })
  allergens: string[];
}

export class SetRestoProductDietaryDto {
  @IsArray()
  @IsIn([...RESTO_DIETARY_TAGS], { each: true })
  dietaryTags: string[];
}

export class SetRestoProductDayPartsDto {
  /** Empty = available all day */
  @IsArray()
  @IsIn([...RESTO_DAY_PARTS], { each: true })
  dayParts: string[];
}

export class CloseRestoPaymentLineDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount: number;
}

export class CloseRestoOrderDto {
  /**
   * When true: free table only (no invoice). Default false = paid close via POS.
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  soft?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  /** Split tender — amounts should cover subtotal + tip + service charge */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloseRestoPaymentLineDto)
  payments?: CloseRestoPaymentLineDto[];

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  /** Redeem loyalty points at paid close (POS incentives) */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  loyaltyPointsToRedeem?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  tipAmount?: number;

  /** Who receives tip attribution (defaults to section server → opener) */
  @IsOptional()
  @IsUUID()
  tipAssigneeId?: string;

  /** Absolute service charge amount (added with tip on POS close) */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  serviceChargeAmount?: number;

  /** Or percent of billable subtotal (0–30) */
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(30)
  serviceChargePct?: number;
}

/** Pay one seat: split those lines to a child check then close it */
export class SettleRestoBySeatDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  seat: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloseRestoPaymentLineDto)
  payments?: CloseRestoPaymentLineDto[];

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsUUID()
  tipAssigneeId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(30)
  serviceChargePct?: number;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  loyaltyPointsToRedeem?: number;
}

/** Equal N-way tender split on one close (single invoice) */
export class SettleRestoEqualDto {
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(20)
  parts: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsUUID()
  tipAssigneeId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(30)
  serviceChargePct?: number;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  loyaltyPointsToRedeem?: number;
}

/** Online pay link for table (partner checkout) — order stays open until paid */
export class CreateRestoPayLinkDto {
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsUUID()
  tipAssigneeId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  serviceChargeAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(30)
  serviceChargePct?: number;

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;
}

export class PublicGuestPayDto {
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(30)
  serviceChargePct?: number;
}

export class UpdateRestoDeliveryDto {
  @IsIn(['QUEUED', 'KITCHEN', 'READY', 'OUT', 'DELIVERED'])
  deliveryStatus: 'QUEUED' | 'KITCHEN' | 'READY' | 'OUT' | 'DELIVERED';

  @IsOptional()
  @IsString()
  @MaxLength(80)
  driverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  driverPhone?: string;
}

export class SetRestoProductStationDto {
  @IsOptional()
  @IsUUID()
  stationId?: string | null;
}

export class CreateRestoReservationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  guestName: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  guests?: number;

  @IsString()
  reservedAt: string;

  @IsOptional()
  @IsUUID()
  tableId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateRestoReservationStatusDto {
  @IsIn(['PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW'])
  status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';
}

export class RestoRecipeItemDto {
  @IsUUID()
  componentProductId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  qty: number;
}

export class UpsertRestoRecipeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RestoRecipeItemDto)
  items: RestoRecipeItemDto[];
}

export class PublicGuestOrderItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0.001)
  @Max(20)
  qty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  course?: number;

  /** Seat 1..guests; omit/null = shared */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  seat?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RestoModifierChoiceDto)
  modifiers?: RestoModifierChoiceDto[];
}

export class PublicGuestOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PublicGuestOrderItemDto)
  items: PublicGuestOrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  guestNote?: string;
}

export class PublicGuestCallDto {
  @IsIn(['WAITER', 'CHECK', 'WATER'])
  type: 'WAITER' | 'CHECK' | 'WATER';
}

export class AssignRestoSectionDto {
  @IsUUID()
  zoneId: string;

  @IsUUID()
  userId: string;
}

export class PublicGuestLoyaltyDto {
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class AttachRestoLoyaltyDto {
  @IsOptional()
  @IsUUID()
  contactId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class RestoDayPartWindowDto {
  /** Hour 0–23 inclusive start */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  start: number;

  /** Hour 0–23 exclusive end (may wrap past midnight when start > end) */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  end: number;
}

export class RestoDayPartsScheduleDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RestoDayPartWindowDto)
  breakfast?: RestoDayPartWindowDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RestoDayPartWindowDto)
  lunch?: RestoDayPartWindowDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RestoDayPartWindowDto)
  dinner?: RestoDayPartWindowDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RestoDayPartWindowDto)
  late?: RestoDayPartWindowDto;
}

export class UpdateRestoConfigDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RestoDayPartsScheduleDto)
  dayParts?: RestoDayPartsScheduleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RestoKitchenSlaDto)
  kitchenSla?: RestoKitchenSlaDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RestoBookingConfigDto)
  booking?: RestoBookingConfigDto;
}

export class RestoBookingConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Human-friendly public path segment; auto-generated when enabling if empty */
  @IsOptional()
  @IsString()
  @MaxLength(48)
  publicSlug?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxParty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  minParty?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(120)
  slotMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  horizonDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  openHour?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  closeHour?: number;

  /** Expected table turn / conflict window minutes */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(240)
  turnMinutes?: number;

  @IsOptional()
  @IsBoolean()
  autoConfirm?: boolean;

  @IsOptional()
  @IsBoolean()
  autoNotify?: boolean;
}

export class PublicCreateBookingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  guestName: string;

  @IsString()
  @MinLength(6)
  @MaxLength(40)
  phone: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  guests: number;

  /** ISO datetime — must land on an available slot */
  @IsString()
  reservedAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RestoKitchenSlaDto {
  /** Minutes until warn tone on KDS (default 8) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(120)
  warnMinutes?: number;

  /** Minutes until critical tone on KDS (default 15) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(180)
  criticalMinutes?: number;

  /** Minutes until warn on expo pass (default 5) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  expoWarnMinutes?: number;
}

export class RestoKitchenRushDto {
  @IsBoolean()
  rush: boolean;
}

export class RestoKitchenHoldDto {
  @IsBoolean()
  hold: boolean;
}

export class RestoKitchenRecallDto {
  @IsIn(['PREPARING', 'READY'])
  to: 'PREPARING' | 'READY';
}

export class ExternalRestoOrderItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  /** Match Product.sku */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  /** Match Product.barcode */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  barcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  @Max(999)
  qty?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RestoModifierChoiceDto)
  modifiers?: RestoModifierChoiceDto[];
}

/** Ingest delivery/takeaway from Talabat / Jahez / Careem / custom middleware */
export class IngestExternalRestoOrderDto {
  @IsEnum(RestoOrderChannel)
  @IsIn([RestoOrderChannel.TAKEAWAY, RestoOrderChannel.DELIVERY])
  channel: RestoOrderChannel;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  externalChannel: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  externalOrderId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExternalRestoOrderItemDto)
  items: ExternalRestoOrderItemDto[];

  /** Fire to KDS after create (default true) */
  @IsOptional()
  @IsBoolean()
  autoSend?: boolean;
}


