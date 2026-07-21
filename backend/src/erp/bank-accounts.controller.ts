import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ErpService } from './erp.service';
import { BankAccountDto } from './dto/erp.dto';
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
  @Put(':id') update(@CurrentUser() u: TokenPayload, @Param('id') id: string, @Body() dto: Partial<BankAccountDto>) {
    return this.erp.updateBankAccount(u.companyId, id, dto);
  }
  @Delete(':id') remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deleteBankAccount(u.companyId, id);
  }
}
