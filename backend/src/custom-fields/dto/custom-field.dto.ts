import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomFieldEntity, CustomFieldType } from '@prisma/client';

export class CustomFieldDefinitionDto {
  @ApiProperty({ enum: CustomFieldEntity })
  @IsEnum(CustomFieldEntity)
  entityType: CustomFieldEntity;

  @ApiProperty({ example: 'region' })
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'key must be lowercase letters, numbers, underscores',
  })
  key: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labelEn?: string;

  @ApiProperty({ enum: CustomFieldType })
  @IsEnum(CustomFieldType)
  fieldType: CustomFieldType;

  @ApiPropertyOptional({ description: 'SELECT options as string array' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
