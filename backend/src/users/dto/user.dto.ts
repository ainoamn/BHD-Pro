import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  MinLength,
  IsOptional,
  IsObject,
  IsBoolean,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, 'hidden' | 'view' | 'edit'>;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email', 'password'] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, 'hidden' | 'view' | 'edit'> | null;
}
