import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErpService } from './erp.service';
import { BankAccountDto, BankStatementLineDto, BankTransferDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';

@ApiTags('Bank Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(
    private erp: ErpService,
    private dualControl: DualControlService,
  ) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findBankAccounts(u.companyId);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@CurrentUser() u: TokenPayload, @Body() dto: BankAccountDto) {
    return this.erp.createBankAccount(u.companyId, dto);
  }

  @Post('transfer')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Internal transfer between two bank accounts (GL + balances)' })
  async transfer(@CurrentUser() u: TokenPayload, @Body() dto: BankTransferDto) {
    await this.dualControl.assertApproved(
      u.companyId,
      u,
      'BANK_INTERNAL_TRANSFER',
      dto.approval,
    );
    return this.erp.transferBetweenBanks(u.companyId, u.sub, dto);
  }

  @Post('statement-lines/:lineId/toggle-reconciled')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Mark statement line as reconciled / unreconciled' })
  toggleReconciled(@CurrentUser() u: TokenPayload, @Param('lineId') lineId: string) {
    return this.erp.toggleStatementReconciled(u.companyId, lineId);
  }

  @Delete('statement-lines/:lineId')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete a bank statement line' })
  deleteLine(@CurrentUser() u: TokenPayload, @Param('lineId') lineId: string) {
    return this.erp.deleteStatementLine(u.companyId, lineId);
  }

  @Get(':id/statement-lines')
  @ApiOperation({ summary: 'List bank statement lines for reconciliation' })
  listLines(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.listStatementLines(u.companyId, id);
  }

  @Post(':id/statement-lines')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @ApiOperation({ summary: 'Add a bank statement line' })
  addLine(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Body() dto: BankStatementLineDto,
  ) {
    return this.erp.addStatementLine(u.companyId, id, dto);
  }

  @Get(':id/reconciliation')
  @ApiOperation({ summary: 'Bank reconciliation summary report' })
  reconciliation(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.getReconciliationReport(u.companyId, id);
  }

  @Get(':id/suggest-matches')
  @ApiOperation({ summary: 'Suggest GL/payment matches for unmatched statement lines' })
  suggestMatches(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Query('days') days?: string,
  ) {
    const windowDays = days ? Number(days) : 5;
    return this.erp.suggestStatementMatches(
      u.companyId,
      id,
      Number.isFinite(windowDays) ? windowDays : 5,
    );
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  update(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Body() dto: Partial<BankAccountDto>,
  ) {
    return this.erp.updateBankAccount(u.companyId, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deleteBankAccount(u.companyId, id);
  }
}
