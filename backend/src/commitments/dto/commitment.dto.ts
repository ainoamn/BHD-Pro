import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class UpdateCommitmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextRunAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  dayOfMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  pausedUntil?: string;

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
  notes?: string;
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
