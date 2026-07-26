import { IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Integration / Zapier' })
  @IsString()
  @MinLength(2)
  name: string;
}

export class UpdateApiKeyDto extends PartialType(CreateApiKeyDto) {}
