import {
  ArrayUnique,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Integration / Zapier' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({
    example: ['read', 'module:contacts'],
    description: 'read/write and all:modules or module:<module-key>',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(/^(read|write|all:modules|module:[a-zA-Z][a-zA-Z0-9]*)$/, {
    each: true,
  })
  scopes?: string[];

  @ApiPropertyOptional({ example: '2027-08-11T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class UpdateApiKeyDto extends PartialType(CreateApiKeyDto) {}
