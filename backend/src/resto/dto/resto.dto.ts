import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod, RestoOrderChannel } from '@prisma/client';

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

  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  tipAmount?: number;

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
