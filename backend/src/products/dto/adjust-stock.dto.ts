import { IsString, IsNumber, IsOptional, IsEnum, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DualApprovalDto } from '../../dual-control/dto/approval.dto';

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

  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

export class ReverseAdjustStockDto {
  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}
