import { Type } from 'class-transformer';
import { IsString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransferStockDto {
  @ApiProperty({ description: 'Source warehouse UUID' })
  @IsUUID()
  fromWarehouseId: string;

  @ApiProperty({ description: 'Destination warehouse UUID' })
  @IsUUID()
  toWarehouseId: string;

  @ApiProperty({ description: 'Quantity to transfer', minimum: 0.001 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;
}
