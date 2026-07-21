import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { PaymentGatewaySlug, Plan } from '@prisma/client';

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
  @IsEnum(Plan)
  plan: Plan;

  @IsString()
  billing: 'monthly' | 'yearly';

  @IsEnum(PaymentGatewaySlug)
  gatewaySlug: PaymentGatewaySlug;
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
