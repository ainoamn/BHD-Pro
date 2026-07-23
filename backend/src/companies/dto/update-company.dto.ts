import { IsString, IsOptional, IsEmail, IsIn, IsBoolean, IsNumber, Min, Max, MaxLength, Matches, ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  crNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  address?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, v) => v !== undefined)
  @IsEmail({}, { message: 'email must be an email' })
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  website?: string;

  /** Base64 data URL or external image URL */
  @IsOptional()
  @IsString()
  @MaxLength(900000)
  logo?: string | null;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  @IsIn(['OMR', 'SAR', 'AED', 'KWD', 'BHD', 'QAR', 'USD', 'EUR'])
  currency?: string;

  /** Apply VAT on invoices */
  @IsOptional()
  @IsBoolean()
  applyVat?: boolean;

  /** Entered prices already include VAT */
  @IsOptional()
  @IsBoolean()
  pricesIncludeTax?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  vatRate?: number;

  /** ELECTRONIC = e-signature note on docs; MANUAL = blank signature lines */
  @IsOptional()
  @IsString()
  @IsIn(['ELECTRONIC', 'MANUAL'])
  signatureMode?: 'ELECTRONIC' | 'MANUAL';

  /** Primary accent color for invoices / receipts (#RRGGBB) */
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/)
  documentColor?: string;
}
