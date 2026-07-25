import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  IsBoolean,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateProductDto {
  /** Optional — auto-generated serial SKU when omitted */
  @IsOptional()
  @IsString()
  sku?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  /** Optional; send null to clear on update */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  barcode?: string | null;

  @IsNumber()
  @Min(0)
  costPrice: number;

  @IsNumber()
  @Min(0)
  salePrice: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minQuantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Public image URLs (shown on restaurant menu / catalog) */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  /** EU14 allergen codes */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergens?: string[];

  /** When false, POS does not enforce on-hand stock (default true in DB) */
  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;

  /** Home / sector warehouse — scopes POS & resto catalogs */
  @IsOptional()
  @IsUUID()
  warehouseId?: string;

  @IsOptional()
  @IsObject()
  customFieldsJson?: Record<string, unknown>;
}
