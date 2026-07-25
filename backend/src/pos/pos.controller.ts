import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole, PaymentGatewaySlug } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { PosService } from './pos.service';
import {
  ClosePosShiftDto,
  CreatePosCashMovementDto,
  CreatePosDraftDto,
  CreatePosSaleDto,
  LinkPosDto,
  OpenPosShiftDto,
  RefundPosSaleDto,
  UpdatePosDraftDto,
  VoidPosSaleDto,
} from './dto/pos.dto';
import { PaymentsService } from '../payments/payments.service';
import { CompanyGatewaysService } from '../payments/company-gateways.service';
import { GATEWAY_META } from '../payments/gateway.constants';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

class PartnerCheckoutDto {
  @IsOptional()
  @IsEnum(PaymentGatewaySlug)
  gatewaySlug?: PaymentGatewaySlug;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerEmail?: string;
}

const POS_STAFF = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.CASHIER,
] as const;

@ApiTags('POS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pos')
export class PosController {
  constructor(
    private pos: PosService,
    private payments: PaymentsService,
    private companyGateways: CompanyGatewaysService,
  ) {}

  @Get('link-status')
  @ApiOperation({ summary: 'Accounting ↔ POS link status for company' })
  linkStatus(@CurrentUser() user: TokenPayload) {
    return this.pos.getLinkStatus(user.companyId);
  }

  @Post('link/activate')
  @ApiOperation({ summary: 'Link POS to Accounting via shared login session' })
  activate(@CurrentUser() user: TokenPayload) {
    return this.pos.activateLink(user.companyId);
  }

  @Post('link/generate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate technical integration key (ADMIN, shown once)' })
  generate(@CurrentUser() user: TokenPayload) {
    return this.pos.generateIntegrationKey(user.companyId);
  }

  @Post('link')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm link with integration key (ADMIN, same company)' })
  linkWithKey(@CurrentUser() user: TokenPayload, @Body() dto: LinkPosDto) {
    return this.pos.linkWithKey(user.companyId, dto.key);
  }

  @Get('products/lookup')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Lookup product by barcode or SKU' })
  lookup(
    @CurrentUser() user: TokenPayload,
    @Query('code') code: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.pos.lookupProduct(user.companyId, code || '', warehouseId);
  }

  @Get('products/search')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Search POS catalog' })
  search(
    @CurrentUser() user: TokenPayload,
    @Query('q') q?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.pos.searchProducts(user.companyId, q || '', warehouseId);
  }

  @Get('catalog/sync')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Full active catalog + stock for offline cache' })
  syncCatalog(@CurrentUser() user: TokenPayload, @Query('warehouseId') warehouseId?: string) {
    return this.pos.syncCatalog(user.companyId, warehouseId);
  }

  @Get('stock/sync')
  @Roles(...POS_STAFF)
  @ApiOperation({
    summary: 'Full or incremental stock sync for offline POS (pass since=ISO for deltas)',
  })
  syncStock(
    @CurrentUser() user: TokenPayload,
    @Query('warehouseId') warehouseId?: string,
    @Query('since') since?: string,
  ) {
    return this.pos.syncStock(user.companyId, warehouseId, since);
  }

  @Get('drafts')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'List POS parked carts (newest 50)' })
  listDrafts(@CurrentUser() user: TokenPayload) {
    return this.pos.listDrafts(user.companyId);
  }

  @Post('drafts')
  @Roles(...POS_STAFF)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Park POS cart as server-backed draft' })
  createDraft(@CurrentUser() user: TokenPayload, @Body() dto: CreatePosDraftDto) {
    return this.pos.createDraft(user.companyId, user.sub, dto);
  }

  @Patch('drafts/:id')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Update parked POS cart name and/or notes' })
  updateDraft(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePosDraftDto,
  ) {
    return this.pos.updateDraft(user.companyId, id, dto);
  }

  @Delete('drafts/:id')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Delete a parked POS cart' })
  deleteDraft(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.pos.deleteDraft(user.companyId, id);
  }

  @Post('sales')
  @Roles(...POS_STAFF)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Complete POS cash sale (stock reserve then invoice)' })
  sale(@CurrentUser() user: TokenPayload, @Body() dto: CreatePosSaleDto) {
    return this.pos.createSale(user.companyId, user, dto);
  }

  @Get('sales/by-number')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Find Hisaby POS cash sale by invoice/receipt number' })
  saleByNumber(@CurrentUser() user: TokenPayload, @Query('number') number?: string) {
    return this.pos.findSaleByNumber(user.companyId, number);
  }

  @Post('sales/:id/void')
  @Roles(...POS_STAFF)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Void POS cash sale (reverse payment + restore stock)' })
  voidSale(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: VoidPosSaleDto,
  ) {
    return this.pos.voidSale(user.companyId, user, id, dto?.approval);
  }

  @Post('sales/:id/refund')
  @Roles(...POS_STAFF)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Partial POS refund (credit note + stock restore)' })
  refundSale(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: RefundPosSaleDto,
  ) {
    return this.pos.refundSale(user.companyId, user, id, dto);
  }

  @Get('stats/today')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Today POS sales/refund/void totals (Asia/Muscat day)' })
  todayStats(
    @CurrentUser() user: TokenPayload,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.pos.getTodayStats(user.companyId, warehouseId || undefined);
  }

  @Get('stats/shifts-today')
  @Roles(...POS_STAFF)
  @ApiOperation({
    summary:
      'All warehouses’ shifts for today (Asia/Muscat) with sales/cash totals — managers see all; cashier sees own',
  })
  shiftsToday(@CurrentUser() user: TokenPayload) {
    return this.pos.getShiftsToday(user.companyId, user);
  }

  @Get('shifts/current')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Get open POS shift + live Z totals (per warehouse)' })
  currentShift(
    @CurrentUser() user: TokenPayload,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.pos.getCurrentShift(user.companyId, warehouseId || null);
  }

  @Post('shifts/current/cash-movements')
  @Roles(...POS_STAFF)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Cash in / cash out on the current open shift' })
  createCashMovement(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreatePosCashMovementDto,
  ) {
    return this.pos.createCashMovement(user.companyId, user.sub, dto);
  }

  @Get('customers/:id/recent-sales')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Last 5 sales invoices for a POS customer' })
  customerRecentSales(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.pos.getCustomerRecentSales(user.companyId, id);
  }

  @Get('shifts/current/x-report')
  @Roles(...POS_STAFF)
  @ApiOperation({
    summary: 'X-report for the current open shift (live totals, does not close)',
  })
  currentXReport(
    @CurrentUser() user: TokenPayload,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.pos.getCurrentXReport(user.companyId, warehouseId || null);
  }

  @Get('shifts')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'List recent POS shifts' })
  listShifts(@CurrentUser() user: TokenPayload) {
    return this.pos.listShifts(user.companyId, user);
  }

  @Post('shifts/open')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Open a POS cash-drawer shift for a warehouse' })
  openShift(@CurrentUser() user: TokenPayload, @Body() dto: OpenPosShiftDto) {
    return this.pos.openShift(user.companyId, user.sub, dto);
  }

  @Post('shifts/close')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Close open POS shift and save Z-report' })
  closeShift(@CurrentUser() user: TokenPayload, @Body() dto: ClosePosShiftDto) {
    return this.pos.closeShift(user.companyId, user, dto);
  }

  @Get('shifts/:id/x-report')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'X-report for an open POS shift (does not close)' })
  xReport(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.pos.getXReport(user.companyId, id);
  }

  @Get('shifts/:id/z-report')
  @Roles(...POS_STAFF)
  @ApiOperation({ summary: 'Z-report totals for a POS shift' })
  zReport(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.pos.getZReport(user.companyId, id);
  }

  @Get('partner-pay/gateways')
  @Roles(...POS_STAFF)
  @ApiOperation({
    summary:
      'List enabled company payment gateways for partner card/wallet pay (NOT NFC badge dual-control)',
  })
  async partnerGateways(@CurrentUser() user: TokenPayload) {
    const gateways = await this.companyGateways.listEnabled(user.companyId);
    return {
      note: 'Partner gateway checkout (Thawani/Stripe/PayPal). NFC badge is dual-control approval only.',
      gateways: gateways.map((g) => {
        const meta = GATEWAY_META[g.slug as keyof typeof GATEWAY_META];
        return {
          slug: g.slug,
          name: meta?.nameEn || g.slug,
          provider: g.slug,
          isTestMode: g.isTestMode,
        };
      }),
    };
  }

  @Post('sales/:invoiceId/partner-checkout')
  @Roles(...POS_STAFF)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Start partner payment checkout (card/wallet via Thawani/Stripe/PayPal) for a POS sales invoice',
  })
  async partnerCheckout(
    @CurrentUser() user: TokenPayload,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: PartnerCheckoutDto,
  ) {
    let slug = dto.gatewaySlug;
    if (!slug) {
      const enabled = await this.companyGateways.listEnabled(user.companyId);
      slug = enabled[0]?.slug;
    }
    if (!slug) {
      throw new BadRequestException(
        'No enabled company payment gateway — configure Thawani/Stripe/PayPal first',
      );
    }
    return this.payments.createInvoiceCollectionCheckout({
      companyId: user.companyId,
      invoiceId,
      gatewaySlug: slug as any,
      customerEmail: dto.customerEmail,
    });
  }
}
