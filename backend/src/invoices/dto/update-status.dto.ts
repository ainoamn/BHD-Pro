import { Type } from 'class-transformer';
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { DualApprovalDto } from '../../dual-control/dto/approval.dto';

export class UpdateInvoiceStatusDto {
  @ApiProperty({ enum: InvoiceStatus })
  @IsEnum(InvoiceStatus)
  status: InvoiceStatus;

  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

export class ReverseAllPaymentsDto {
  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}
