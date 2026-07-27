import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { ManagerReportsService } from './manager-reports.service';
import {
  SaveManagerReportSubscriptionsDto,
  SendManagerReportNowDto,
} from './dto/manager-report.dto';

@ApiTags('Manager Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('manager-reports')
export class ManagerReportsController {
  constructor(private readonly service: ManagerReportsService) {}

  @Get('subscriptions')
  list(@CurrentUser() user: TokenPayload) {
    return this.service.list(user.companyId);
  }

  @Post('subscriptions')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  save(
    @CurrentUser() user: TokenPayload,
    @Body() dto: SaveManagerReportSubscriptionsDto,
  ) {
    return this.service.save(user.companyId, user.sub, dto);
  }

  @Post('send-now')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  sendNow(@CurrentUser() user: TokenPayload, @Body() dto: SendManagerReportNowDto) {
    return this.service.sendNow(user.companyId, dto.userId);
  }
}
