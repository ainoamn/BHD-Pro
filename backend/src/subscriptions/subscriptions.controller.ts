import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { Plan } from '@prisma/client';
import { IsEnum, IsIn } from 'class-validator';

class UpgradePlanDto {
  @IsEnum(Plan)
  plan: Plan;

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
  @ApiOperation({ summary: 'Current company subscription' })
  getCurrent(@CurrentUser() user: TokenPayload) {
    return this.subscriptionsService.getCurrent(user.companyId);
  }

  @Post('upgrade')
  @ApiOperation({ summary: 'Upgrade subscription plan' })
  upgrade(@CurrentUser() user: TokenPayload, @Body() dto: UpgradePlanDto) {
    return this.subscriptionsService.upgrade(user.companyId, dto.plan, dto.billing);
  }
}
