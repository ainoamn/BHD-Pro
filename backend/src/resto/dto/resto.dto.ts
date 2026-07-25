import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LinkRestoDto {
  @IsString()
  key: string;
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
  @IsUUID()
  tableId: string;

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
