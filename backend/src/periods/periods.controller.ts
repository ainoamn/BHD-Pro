import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PeriodsService } from './periods.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Accounting Periods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('periods')
export class PeriodsController {
  constructor(private periods: PeriodsService) {}

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
  @ApiOperation({ summary: 'Lock an accounting period' })
  lock(
    @CurrentUser() user: TokenPayload,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.periods.lock(user.companyId, user.sub, year, month);
  }

  @Post(':year/:month/unlock')
  @ApiOperation({ summary: 'Unlock an accounting period (admin only)' })
  unlock(
    @CurrentUser() user: TokenPayload,
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    return this.periods.unlock(user.companyId, user.role, year, month);
  }
}
