import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DualApprovalDto } from '../../dual-control/dto/approval.dto';

export class CreateCommitmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ example: 'RENT' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.001)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'MONTHLY' })
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiProperty()
  @IsDateString()
  nextRunAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  dayOfMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expenseAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  payableAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCommitmentDto extends PartialType(CreateCommitmentDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  pausedUntil?: string;
}

export class PauseCommitmentDto {
  @ApiPropertyOptional({ description: 'ISO date until which commitment is paused' })
  @IsOptional()
  @IsDateString()
  pausedUntil?: string;

  @ApiPropertyOptional({ description: 'DAY | MONTH | YEAR relative pause' })
  @IsOptional()
  @IsString()
  deferUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  deferCount?: number;
}

export class ReverseCommitmentDto {
  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}
