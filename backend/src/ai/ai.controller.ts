import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { PosService } from '../pos/pos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { UserRole } from '@prisma/client';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RequirePlanFeature } from '../common/decorators/require-plan-feature.decorator';

@ApiTags('AI Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PlanFeatureGuard)
@RequirePlanFeature('aiAnalytics')
@Controller('ai')
export class AiController {
  constructor(
    private aiService: AiService,
    private posService: PosService,
  ) {}

  @Get('analytics')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Rule-based analytics + human-in-loop suggestions (no auto-apply)' })
  getAnalytics(@CurrentUser() user: TokenPayload) {
    return this.aiService.getAnalytics(user.companyId);
  }

  @Post('propose')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Queue AI suggestions as management alerts for human approval',
  })
  propose(@CurrentUser() user: TokenPayload) {
    return this.aiService.proposeToManagers(user.companyId);
  }

  @Get('shifts/:shiftId/anomalies')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT, UserRole.CASHIER)
  @ApiOperation({
    summary: 'Rule-based POS shift anomaly review (variance, voids, cash-out, commission)',
  })
  shiftAnomalies(
    @CurrentUser() user: TokenPayload,
    @Param('shiftId') shiftId: string,
  ) {
    return this.posService.analyzeShiftAnomalies(user.companyId, shiftId);
  }
}
