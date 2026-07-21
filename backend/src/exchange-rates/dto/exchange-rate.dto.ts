import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExchangeRateDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ example: 'OMR' })
  @IsString()
  @Length(3, 3)
  toCurrency: string;

  @ApiProperty({ example: 0.385 })
  @IsNumber()
  @Min(0.000001)
  rate: number;

  @ApiProperty({ example: '2026-07-21' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  notes?: string;
}
