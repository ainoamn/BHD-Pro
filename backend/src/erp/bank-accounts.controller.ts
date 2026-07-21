import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ErpService } from './erp.service';
import { BankAccountDto, BankStatementLineDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Bank Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private erp: ErpService) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findBankAccounts(u.companyId);
  }

  @Post() create(@CurrentUser() u: TokenPayload, @Body() dto: BankAccountDto) {
    return this.erp.createBankAccount(u.companyId, dto);
  }

  @Post('statement-lines/:lineId/toggle-reconciled')
  @ApiOperation({ summary: 'Mark statement line as reconciled / unreconciled' })
  toggleReconciled(@CurrentUser() u: TokenPayload, @Param('lineId') lineId: string) {
    return this.erp.toggleStatementReconciled(u.companyId, lineId);
  }

  @Delete('statement-lines/:lineId')
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

  @Put(':id') update(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Body() dto: Partial<BankAccountDto>,
  ) {
    return this.erp.updateBankAccount(u.companyId, id, dto);
  }

  @Delete(':id') remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deleteBankAccount(u.companyId, id);
  }
}
