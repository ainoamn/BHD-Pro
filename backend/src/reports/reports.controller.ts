import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('profit-loss')
  profitLoss(@CurrentUser() user: TokenPayload) {
    return this.reportsService.profitAndLoss(user.companyId);
  }

  @Get('balance-sheet')
  balanceSheet(@CurrentUser() user: TokenPayload) {
    return this.reportsService.balanceSheet(user.companyId);
  }

  @Get('trial-balance')
  trialBalance(@CurrentUser() user: TokenPayload) {
    return this.reportsService.trialBalance(user.companyId);
  }

  @Get('cash-flow')
  cashFlow(@CurrentUser() user: TokenPayload) {
    return this.reportsService.cashFlow(user.companyId);
  }
}
