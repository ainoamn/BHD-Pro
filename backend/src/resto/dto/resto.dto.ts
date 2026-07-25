import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
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
