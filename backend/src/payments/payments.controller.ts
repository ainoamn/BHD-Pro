import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PaymentGatewaySlug, UserRole } from '@prisma/client';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { PaymentsService } from './payments.service';
import { CompanyGatewaysService } from './company-gateways.service';
import { PlatformGatewaysService } from './platform-gateways.service';
import {
  CreateInvoiceCheckoutDto,
  CreateSubscriptionCheckoutDto,
  UpdateCompanyGatewayDto,
  UpdatePlatformGatewayDto,
} from './dto/payment.dto';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private companyGateways: CompanyGatewaysService,
    private platformGateways: PlatformGatewaysService,
  ) {}

  @Get('platform-gateways')
  @ApiOperation({ summary: 'List enabled platform gateways for subscription checkout' })
  listPlatformGateways() {
    return this.payments.listPlatformGatewaysPublic();
  }

  @Get('company-gateways')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List company payment gateways (admin)' })
  async listCompanyGateways(@CurrentUser() user: TokenPayload) {
    const gateways = await this.companyGateways.list(user.companyId);
    return gateways.map((g) => this.companyGateways.toSafe(g));
  }

  @Patch('company-gateways/:slug')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update company payment gateway credentials' })
  async updateCompanyGateway(
    @CurrentUser() user: TokenPayload,
    @Param('slug') slug: PaymentGatewaySlug,
    @Body() dto: UpdateCompanyGatewayDto,
  ) {
    const updated = await this.companyGateways.update(
      user.companyId,
      slug,
      dto,
      user.role,
    );
    return this.companyGateways.toSafe(updated);
  }

  @Post('subscription/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create subscription payment checkout' })
  createSubscriptionCheckout(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateSubscriptionCheckoutDto,
  ) {
    return this.payments.createSubscriptionCheckout({
      companyId: user.companyId,
      userEmail: user.email,
      plan: dto.plan,
      billing: dto.billing,
      gatewaySlug: dto.gatewaySlug,
    });
  }

  @Post('invoices/:invoiceId/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create online payment checkout for sales invoice (company gateway)' })
  createInvoiceCheckout(
    @CurrentUser() user: TokenPayload,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateInvoiceCheckoutDto,
  ) {
    return this.payments.createInvoiceCollectionCheckout({
      companyId: user.companyId,
      invoiceId,
      gatewaySlug: dto.gatewaySlug,
      customerEmail: dto.customerEmail,
    });
  }

  @Get('public/invoice/:invoiceId')
  @ApiOperation({ summary: 'Public invoice pay info' })
  getPublicInvoicePayInfo(@Param('invoiceId') invoiceId: string) {
    return this.payments.getPublicInvoicePayInfo(invoiceId);
  }

  @Post('public/invoice/:invoiceId/checkout')
  @ApiOperation({ summary: 'Public checkout for invoice (uses company gateway)' })
  async publicInvoiceCheckout(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateInvoiceCheckoutDto,
  ) {
    const info = await this.payments.getPublicInvoicePayInfo(invoiceId);
    return this.payments.createInvoiceCollectionCheckout({
      companyId: info.companyId,
      invoiceId,
      gatewaySlug: dto.gatewaySlug,
      customerEmail: dto.customerEmail,
    });
  }

  @Get('billing/:number')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getBillingInvoice(@CurrentUser() user: TokenPayload, @Param('number') number: string) {
    return this.payments.getBillingInvoice(user.companyId, number);
  }

  @Get('checkout/complete')
  @ApiOperation({ summary: 'Payment return URL — verifies and redirects to frontend' })
  async checkoutComplete(@Query() query: Record<string, string>, @Res() res: Response) {
    const result = await this.payments.completeCheckout(query);
    const frontend = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';

    if (result.purpose === 'SUBSCRIPTION') {
      return res.redirect(
        `${frontend}/checkout/success?invoice=${encodeURIComponent(result.invoiceNumber)}&paid=${result.paid ? '1' : '0'}`,
      );
    }

    return res.redirect(
      `${frontend}/pay/success?invoice=${encodeURIComponent(result.invoiceNumber)}&paid=${result.paid ? '1' : '0'}`,
    );
  }

  @Post('webhooks/:slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Platform payment webhook' })
  async platformWebhook(
    @Param('slug') slug: PaymentGatewaySlug,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: unknown,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers[k.toLowerCase()] = v;
    }
    return this.payments.handleWebhook(slug, rawBody, headers, 'platform');
  }
}

@ApiTags('Platform Gateways Admin')
@Controller('admin/payment-gateways')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class PlatformGatewaysController {
  constructor(private platformGateways: PlatformGatewaysService) {}

  @Get()
  listAll(@CurrentUser() user: TokenPayload) {
    this.platformGateways.assertPlatformAdmin(user.email);
    return this.platformGateways.listAllSafe();
  }

  @Patch(':slug')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('slug') slug: PaymentGatewaySlug,
    @Body() dto: UpdatePlatformGatewayDto,
  ) {
    this.platformGateways.assertPlatformAdmin(user.email);
    return this.platformGateways.update(slug, dto).then((g) => this.platformGateways.toSafeAdmin(g));
  }
}
