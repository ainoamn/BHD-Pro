import { IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum StockAdjustMode {
  IN = 'IN',
  OUT = 'OUT',
  SET = 'SET',
}

export class AdjustStockDto {
  @ApiProperty({ enum: StockAdjustMode })
  @IsEnum(StockAdjustMode)
  mode: StockAdjustMode;

  @ApiProperty({ description: 'Qty to add/remove, or absolute qty when mode=SET' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
