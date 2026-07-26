import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { AdminService } from './admin.service';

@ApiTags('Platform Admin')
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if current user is platform admin' })
  me(@CurrentUser() user: TokenPayload) {
    return this.admin.me(user.email);
  }

  @Get('operators')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List platform operators' })
  listOperators() {
    return this.admin.listOperators();
  }

  @Post('operators')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Appoint a platform operator' })
  appointOperator(
    @CurrentUser() user: TokenPayload,
    @Body()
    body: {
      email: string;
      name?: string;
      permissions?: string[];
      isDeputy?: boolean;
    },
  ) {
    return this.admin.appointOperator({
      email: body.email,
      name: body.name,
      permissions: body.permissions,
      isDeputy: body.isDeputy,
      createdBy: user.email,
      actorEmail: user.email,
    });
  }

  @Patch('operators/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  updateOperator(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      permissions?: string[];
      isActive?: boolean;
      isDeputy?: boolean;
    },
  ) {
    return this.admin.updateOperator(id, body, user.email);
  }

  @Delete('operators/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  removeOperator(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.admin.removeOperator(id, user.email);
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  overview() {
    return this.admin.overview();
  }

  @Get('tenants')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  tenants(
    @Query('q') q?: string,
    @Query('plan') plan?: string,
    @Query('active') active?: string,
  ) {
    const activeBool =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return this.admin.listTenants(q, plan, activeBool);
  }

  @Get('tenants/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  tenant(@Param('id') id: string) {
    return this.admin.getTenant(id);
  }

  @Patch('tenants/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  updateTenant(
    @Param('id') id: string,
    @Body()
    body: {
      isActive?: boolean;
      plan?: string;
      planExpiry?: string | null;
      planStartedAt?: string | null;
      name?: string;
      usersLimitOverride?: number | null;
      invoicesLimitOverride?: number | null;
      permanentDiscountPct?: number | null;
      permanentDiscountNote?: string | null;
    },
  ) {
    return this.admin.updateTenant(id, body);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  users(
    @Query('q') q?: string,
    @Query('role') role?: string,
    @Query('isActive') isActive?: string,
    @Query('plan') plan?: string,
    @Query('sort') sort?: string,
  ) {
    const isActiveBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.admin.listUsers({ q, role, isActive: isActiveBool, plan, sort });
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  userDetail(@Param('id') id: string) {
    return this.admin.getUserDetail(id);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  setUserActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.admin.setUserActive(id, !!body.isActive);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Hard-delete a platform user' })
  deleteUser(@Param('id') id: string) {
    return this.admin.deleteUser(id);
  }

  @Post('users/:id/reset-password')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset user password and email temporary credentials' })
  resetUserPassword(@Param('id') id: string) {
    return this.admin.resetUserPassword(id);
  }

  @Get('billing')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  billing(@Query('status') status?: string) {
    return this.admin.listBilling(status);
  }

  @Get('offers')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  offers() {
    return this.admin.listOffers();
  }

  @Post('offers')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  createOffer(@Body() body: Parameters<AdminService['createOffer']>[0]) {
    return this.admin.createOffer(body);
  }

  @Patch('offers/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  updateOffer(
    @Param('id') id: string,
    @Body() body: Parameters<AdminService['updateOffer']>[1],
  ) {
    return this.admin.updateOffer(id, body);
  }

  @Delete('offers/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  deleteOffer(@Param('id') id: string) {
    return this.admin.deleteOffer(id);
  }

  @Get('plans')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List editable plan definitions with feature flags' })
  listPlans() {
    return this.admin.listPlanDefinitions();
  }

  @Post('plans')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  createPlan(@Body() body: Parameters<AdminService['createPlanDefinition']>[0]) {
    return this.admin.createPlanDefinition(body);
  }

  @Patch('plans/:code')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  updatePlan(
    @Param('code') code: string,
    @Body() body: Parameters<AdminService['updatePlanDefinition']>[1],
  ) {
    return this.admin.updatePlanDefinition(code, body);
  }

  @Delete('plans/:code')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  deletePlan(@Param('code') code: string) {
    return this.admin.deletePlanDefinition(code);
  }

  @Get('visits')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  visits(@Query('limit') limit?: string) {
    return this.admin.listVisits(limit ? Number(limit) : 100);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  sessions(@Query('limit') limit?: string) {
    return this.admin.recentSessions(limit ? Number(limit) : 100);
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  settings() {
    return this.admin.getSettings();
  }

  @Patch('settings/:key')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  upsertSetting(@Param('key') key: string, @Body() body: { value: unknown }) {
    return this.admin.upsertSetting(key, body.value);
  }
}

@ApiTags('Public')
@Controller('public')
export class PublicVisitsController {
  private readonly logger = new Logger(PublicVisitsController.name);

  constructor(private admin: AdminService) {}

  @Get('stats')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public platform metrics for the landing page' })
  stats() {
    return this.admin.publicStats();
  }

  @Get('maintenance')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public maintenance mode status' })
  getMaintenance() {
    return this.admin.getMaintenancePublic();
  }

  @Get('plans')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store, max-age=0')
  @ApiOperation({ summary: 'Public active plans for landing pricing' })
  plans() {
    return this.admin.publicPlans();
  }

  @Get('customer-logos')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Paid subscriber company logos for the landing page (excludes free/unpaid tenants)',
  })
  customerLogos() {
    return this.admin.publicCustomerLogos();
  }

  @Post('visits')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Record anonymous site visit (analytics)' })
  record(@Req() req: Request, @Body() body: { path?: string; referrer?: string; country?: string; city?: string }) {
    const forwarded = (req.headers['x-forwarded-for'] as string) || '';
    const ip =
      forwarded.split(',')[0]?.trim() ||
      req.ip ||
      (req.socket as { remoteAddress?: string })?.remoteAddress;

    const headerCountry =
      (req.headers['cf-ipcountry'] as string) ||
      (req.headers['x-vercel-ip-country'] as string) ||
      (req.headers['x-country-code'] as string) ||
      '';
    const headerCity =
      (req.headers['x-vercel-ip-city'] as string) ||
      (req.headers['cf-ipcity'] as string) ||
      '';

    const countryFromHeader =
      headerCountry && headerCountry.toUpperCase() !== 'XX'
        ? headerCountry.toUpperCase()
        : undefined;
    const country = (countryFromHeader || body.country?.trim()?.toUpperCase() || undefined)?.slice(
      0,
      8,
    );

    return this.admin.recordVisit({
      path: body.path || '/',
      referrer: body.referrer,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      country,
      city: (headerCity || body.city)?.slice(0, 80),
    });
  }

  @Post('client-errors')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Browser error beacon (best-effort logging)' })
  clientErrors(
    @Body()
    body: {
      message?: string;
      stack?: string;
      url?: string;
      source?: string;
    },
  ) {
    const message = String(body?.message || 'unknown').slice(0, 500);
    const url = String(body?.url || '').slice(0, 400);
    const source = String(body?.source || 'browser').slice(0, 40);
    this.logger.warn(
      `client-error [${source}] ${message} @ ${url || '-'}`,
    );
    if (body?.stack) {
      this.logger.debug(String(body.stack).slice(0, 2000));
    }
    return { ok: true };
  }
}
