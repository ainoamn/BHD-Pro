import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Plan } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
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
    @Query('plan') plan?: Plan,
    @Query('active') active?: string,
  ) {
    const activeBool =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return this.admin.listTenants(q, plan, activeBool);
  }

  @Patch('tenants/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  updateTenant(
    @Param('id') id: string,
    @Body()
    body: {
      isActive?: boolean;
      plan?: Plan;
      planExpiry?: string | null;
      name?: string;
    },
  ) {
    return this.admin.updateTenant(id, body);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  users(@Query('q') q?: string) {
    return this.admin.listUsers(q);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiBearerAuth()
  setUserActive(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.admin.setUserActive(id, !!body.isActive);
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
  constructor(private admin: AdminService) {}

  @Post('visits')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Record anonymous site visit (analytics)' })
  record(@Req() req: Request, @Body() body: { path?: string; referrer?: string; country?: string; city?: string }) {
    const forwarded = (req.headers['x-forwarded-for'] as string) || '';
    const ip =
      forwarded.split(',')[0]?.trim() ||
      req.ip ||
      (req.socket as { remoteAddress?: string })?.remoteAddress;

    return this.admin.recordVisit({
      path: body.path || '/',
      referrer: body.referrer,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
      country: body.country,
      city: body.city,
    });
  }
}
