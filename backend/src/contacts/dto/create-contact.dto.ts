import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, IsObject, IsNumber, Min, ValidateIf } from 'class-validator';
import { ContactType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateContactDto {
  @IsEnum(ContactType)
  type: ContactType;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail()
  email?: string;

  /** Required for CUSTOMER/BOTH — enforced in ContactsService */
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsObject()
  customFieldsJson?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  openingBalance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number;
}
