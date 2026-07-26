import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiPropertyOptional } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PeriodsService } from './periods.service';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';
import { DualApprovalDto } from '../dual-control/dto/approval.dto';

class PeriodUnlockDto {
  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

@ApiTags('Accounting Periods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('periods')
export class PeriodsController {
  constructor(
    private periods: PeriodsService,
    private dualControl: DualControlService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List months for a year (creates missing months)' })
  @ApiQuery({ name: 'year', required: false })
  list(
    @CurrentUser() user: TokenPayload,
    @Query('year') yearStr?: string,
  ) {
    const year = yearStr ? Number(yearStr) : new Date().getFullYear();
    return this.periods.listYear(user.companyId, year);
  }

  @Post(':year/:month/lock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Lock an accounting period' })
  lock(
    @CurrentUser() user: TokenPayload,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.periods.lock(user.companyId, user.sub, year, month);
  }

  @Post(':year/:month/unlock')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Unlock an accounting period (admin only)' })
  async unlock(
    @CurrentUser() user: TokenPayload,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
    @Body() dto: PeriodUnlockDto,
  ) {
    await this.dualControl.assertApproved(
      user.companyId,
      user,
      'PERIOD_UNLOCK',
      dto?.approval,
    );
    return this.periods.unlock(user.companyId, user.role, year, month);
  }
}
