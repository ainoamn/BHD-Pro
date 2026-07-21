import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  IsDateString,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { PurchaseOrderStatus, ScheduleFrequency } from '@prisma/client';
import { InvoiceItemDto } from './create-invoice.dto';

export class CreatePurchaseOrderDto {
  @IsUUID()
  contactId: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class UpdatePurchaseOrderDto extends CreatePurchaseOrderDto {
  @IsOptional()
  @IsEnum(PurchaseOrderStatus)
  status?: PurchaseOrderStatus;
}

export class CreateScheduledInvoiceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  contactId: string;

  @IsEnum(ScheduleFrequency)
  frequency: ScheduleFrequency;

  @IsDateString()
  nextDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  taxRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
}

export class UpdateScheduledInvoiceDto extends CreateScheduledInvoiceDto {}
