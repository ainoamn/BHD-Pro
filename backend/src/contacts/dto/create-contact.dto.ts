import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum, ValidateIf } from 'class-validator';
import { ContactType } from '@prisma/client';

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

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;
}
