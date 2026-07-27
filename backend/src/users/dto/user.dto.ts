import {
  IsString,
  IsEmail,
  IsNotEmpty,
  IsEnum,
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

  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, 'hidden' | 'view' | 'edit'>;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email'] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, 'hidden' | 'view' | 'edit'> | null;
}

export class ResendInviteDto {
  @IsOptional()
  @IsEmail()
  email?: string;
}
