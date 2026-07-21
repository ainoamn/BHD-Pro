import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { BatchRecordPaymentDto } from './dto/batch-record-payment.dto';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List all invoices for company' })
  findAll(@CurrentUser() user: TokenPayload) {
    return this.invoicesService.findAll(user.companyId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Invoice statistics' })
  @ApiQuery({ name: 'type', required: false, enum: InvoiceType })
  getStats(@CurrentUser() user: TokenPayload, @Query('type') type?: InvoiceType) {
    return this.invoicesService.getStats(user.companyId, type);
  }

  @Get('payments/list')
  @ApiOperation({ summary: 'List payment vouchers (receipts / disbursements)' })
  @ApiQuery({ name: 'type', required: false, enum: ['SALES', 'PURCHASE'] })
  listPayments(
    @CurrentUser() user: TokenPayload,
    @Query('type') type?: 'SALES' | 'PURCHASE',
  ) {
    return this.invoicesService.listPayments(user.companyId, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.invoicesService.findOne(user.companyId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create invoice' })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(user.companyId, user.sub, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update invoice' })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update invoice status' })
  updateStatus(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body('status') status: InvoiceStatus,
  ) {
    return this.invoicesService.updateStatus(user.companyId, id, status);
  }

  @Post('payments/batch')
  @ApiOperation({ summary: 'Record payment across multiple invoices (FIFO / manual split)' })
  recordBatchPayment(
    @CurrentUser() user: TokenPayload,
    @Body() dto: BatchRecordPaymentDto,
  ) {
    return this.invoicesService.recordBatchPayment(user.companyId, dto);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Record payment / receipt against invoice' })
  recordPayment(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.invoicesService.recordPayment(user.companyId, id, dto);
  }

  @Post(':id/unsend')
  @ApiOperation({ summary: 'Revert sent invoice back to draft (no payments recorded)' })
  unsend(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.invoicesService.unsend(user.companyId, id);
  }

  @Post(':id/convert-to-invoice')
  @ApiOperation({ summary: 'Convert quotation to sales invoice' })
  convertQuotation(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
  ) {
    return this.invoicesService.convertQuotationToSales(user.companyId, user.sub, id);
  }

  @Delete(':id/payments/:paymentId')
  @ApiOperation({ summary: 'Reverse / undo a payment receipt' })
  reversePayment(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.invoicesService.reversePayment(user.companyId, id, paymentId);
  }

  @Post(':id/payments/reverse-all')
  @ApiOperation({ summary: 'Reverse all payment receipts on an invoice' })
  reverseAllPayments(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.invoicesService.reverseAllPayments(user.companyId, id);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send invoice by email' })
  send(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body('email') email?: string,
  ) {
    return this.invoicesService.send(user.companyId, id, email);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete invoice' })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.invoicesService.remove(user.companyId, id);
  }
}
