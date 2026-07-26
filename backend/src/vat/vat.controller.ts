import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { VatService } from './vat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { UserRole } from '@prisma/client';

class UpdateOtaConfigDto {
  @IsOptional()
  @IsIn(['mock', 'sandbox', 'live'])
  mode?: 'mock' | 'sandbox' | 'live';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxpayerTin?: string;

  @IsOptional()
  @IsBoolean()
  clientSecretConfigured?: boolean;
}

@ApiTags('VAT / OTA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vat')
export class VatController {
  constructor(private vatService: VatService) {}

  @Get('invoices')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  list(@CurrentUser() user: TokenPayload) {
    return this.vatService.listEInvoices(user.companyId);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  stats(@CurrentUser() user: TokenPayload) {
    return this.vatService.getStats(user.companyId);
  }

  @Get('ota-config')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get Oman OTA e-invoice mode and credentials status' })
  getOta(@CurrentUser() user: TokenPayload) {
    return this.vatService.getOtaConfig(user.companyId);
  }

  @Post('ota-config')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update OTA mode: mock | sandbox | live' })
  updateOta(@CurrentUser() user: TokenPayload, @Body() dto: UpdateOtaConfigDto) {
    return this.vatService.updateOtaConfig(user.companyId, dto);
  }

  @Post('submit/:invoiceId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  submit(@CurrentUser() user: TokenPayload, @Param('invoiceId') invoiceId: string) {
    return this.vatService.submitToOta(user.companyId, invoiceId);
  }
}
