import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DualApprovalDto } from '../../dual-control/dto/approval.dto';

export class PostFxRevaluationDto {
  @IsDateString()
  asOf: string;

  /** Optional subset of invoice IDs from preview; default = all with gain/loss */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  invoiceIds?: string[];

  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

export class ReverseFxRevaluationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4')
  journalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}
