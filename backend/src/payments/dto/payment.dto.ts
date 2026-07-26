import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, IsIn } from 'class-validator';
import { PaymentGatewaySlug } from '@prisma/client';

export class UpdateCompanyGatewayDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, string>;
}

export class CreateSubscriptionCheckoutDto {
  @IsString()
  plan: string;

  @IsIn(['monthly', 'yearly'])
  billing: 'monthly' | 'yearly';

  @IsString()
  gatewaySlug: PaymentGatewaySlug;

  @IsOptional()
  @IsString()
  promoCode?: string;
}

export class CreateInvoiceCheckoutDto {
  @IsEnum(PaymentGatewaySlug)
  gatewaySlug: PaymentGatewaySlug;

  @IsOptional()
  @IsString()
  customerEmail?: string;
}

export class UpdatePlatformGatewayDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isTestMode?: boolean;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, string>;
}
