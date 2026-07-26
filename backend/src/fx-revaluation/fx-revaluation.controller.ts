import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { FxRevaluationService } from './fx-revaluation.service';
import {
  PostFxRevaluationDto,
  ReverseFxRevaluationDto,
} from './dto/post-fx-revaluation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';

@ApiTags('FX Revaluation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fx-revaluation')
export class FxRevaluationController {
  constructor(
    private service: FxRevaluationService,
    private dualControl: DualControlService,
  ) {}

  @Get('preview')
  @ApiOperation({ summary: 'Preview unrealized FX gain/loss on open foreign invoices' })
  @ApiQuery({ name: 'asOf', required: false })
  preview(@CurrentUser() user: TokenPayload, @Query('asOf') asOf?: string) {
    return this.service.preview(user.companyId, asOf);
  }

  @Post('post')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Post FX revaluation journal for as-of date' })
  async post(@CurrentUser() user: TokenPayload, @Body() dto: PostFxRevaluationDto) {
    await this.dualControl.assertApproved(
      user.companyId,
      user,
      'FX_REVALUATION',
      dto.approval,
    );
    return this.service.post(user.companyId, user.sub, dto);
  }

  @Post('reverse')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reverse FX revaluation journal by id or asOf date' })
  async reverse(
    @CurrentUser() user: TokenPayload,
    @Body() dto: ReverseFxRevaluationDto,
  ) {
    await this.dualControl.assertApproved(
      user.companyId,
      user,
      'FX_REVALUATION',
      dto.approval,
    );
    return this.service.reverse(user.companyId, user.sub, dto);
  }
}
