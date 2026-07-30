import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** ~2MB base64 data URL ceiling (chars) */
export const ATTACHMENT_STORAGE_KEY_MAX = 2_800_000;

export class CreateAttachmentDto {
  @ApiProperty({ example: 'INVOICE' })
  @IsString()
  @MaxLength(64)
  entityType: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  entityId: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  mimeType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeBytes?: number;

  @ApiProperty({ description: 'Storage key, path, or data URL (max ~2MB encoded)' })
  @IsString()
  @MinLength(1)
  @MaxLength(ATTACHMENT_STORAGE_KEY_MAX)
  storageKey: string;
}
