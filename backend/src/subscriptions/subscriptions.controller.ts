import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { IsIn, IsString } from 'class-validator';

class UpgradePlanDto {
  @IsString()
  plan: string;

  @IsIn(['monthly', 'yearly'])
  billing: 'monthly' | 'yearly';
}

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List available plans (OMR pricing)' })
  getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Get('current')
  @ApiOperation({
    summary: 'Current company subscription. Pass light=1 for features-only (shell gates).',
  })
  getCurrent(
    @CurrentUser() user: TokenPayload,
    @Query('light') light?: string,
  ) {
    const lightMode =
      light === '1' || light === 'true' || light === 'yes';
    return this.subscriptionsService.getCurrent(user.companyId, {
      light: lightMode,
    });
  }

  @Post('upgrade')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Upgrade subscription plan' })
  upgrade(@CurrentUser() user: TokenPayload, @Body() dto: UpgradePlanDto) {
    return this.subscriptionsService.upgrade(user.companyId, dto.plan, dto.billing);
  }
}
