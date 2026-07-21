import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VatService } from './vat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('VAT / OTA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vat')
export class VatController {
  constructor(private vatService: VatService) {}

  @Get('invoices')
  list(@CurrentUser() user: TokenPayload) {
    return this.vatService.listEInvoices(user.companyId);
  }

  @Get('stats')
  stats(@CurrentUser() user: TokenPayload) {
    return this.vatService.getStats(user.companyId);
  }

  @Post('submit/:invoiceId')
  submit(@CurrentUser() user: TokenPayload, @Param('invoiceId') invoiceId: string) {
    return this.vatService.submitToOta(user.companyId, invoiceId);
  }
}
