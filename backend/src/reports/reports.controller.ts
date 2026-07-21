import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
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

  @Get('ar-aging')
  @ApiOperation({ summary: 'Accounts receivable aging (sales)' })
  arAging(@CurrentUser() user: TokenPayload) {
    return this.reportsService.arAging(user.companyId);
  }

  @Get('ap-aging')
  @ApiOperation({ summary: 'Accounts payable aging (purchases)' })
  apAging(@CurrentUser() user: TokenPayload) {
    return this.reportsService.apAging(user.companyId);
  }

  @Get('contact-statement')
  @ApiOperation({ summary: 'Customer / supplier account statement' })
  @ApiQuery({ name: 'contactId', required: true })
  contactStatement(
    @CurrentUser() user: TokenPayload,
    @Query('contactId') contactId: string,
  ) {
    return this.reportsService.contactStatement(user.companyId, contactId);
  }

  @Get('sales-summary')
  @ApiOperation({ summary: 'Sales revenue summary and top customers' })
  salesSummary(@CurrentUser() user: TokenPayload) {
    return this.reportsService.salesSummary(user.companyId);
  }

  @Get('purchase-summary')
  @ApiOperation({ summary: 'Purchase expense summary and top suppliers' })
  purchaseSummary(@CurrentUser() user: TokenPayload) {
    return this.reportsService.purchaseSummary(user.companyId);
  }

  @Get('vat-summary')
  @ApiOperation({ summary: 'VAT output / input / net summary' })
  vatSummary(@CurrentUser() user: TokenPayload) {
    return this.reportsService.vatSummary(user.companyId);
  }

  @Get('general-ledger')
  @ApiOperation({ summary: 'General ledger journal lines' })
  @ApiQuery({ name: 'accountId', required: false })
  generalLedger(
    @CurrentUser() user: TokenPayload,
    @Query('accountId') accountId?: string,
  ) {
    return this.reportsService.generalLedger(user.companyId, accountId);
  }

  @Get('inventory-summary')
  @ApiOperation({ summary: 'Inventory valuation and low stock' })
  inventorySummary(@CurrentUser() user: TokenPayload) {
    return this.reportsService.inventorySummary(user.companyId);
  }

  @Get('payroll-summary')
  @ApiOperation({ summary: 'Payroll and employee cost summary' })
  payrollSummary(@CurrentUser() user: TokenPayload) {
    return this.reportsService.payrollSummary(user.companyId);
  }

  @Get('cost-center-pl')
  @ApiOperation({ summary: 'Profit & loss by cost center' })
  costCenterPl(@CurrentUser() user: TokenPayload) {
    return this.reportsService.costCenterProfitLoss(user.companyId);
  }

  @Get('project-budget')
  @ApiOperation({ summary: 'Project budget vs actual' })
  projectBudget(@CurrentUser() user: TokenPayload) {
    return this.reportsService.projectBudgetVsActual(user.companyId);
  }
}
