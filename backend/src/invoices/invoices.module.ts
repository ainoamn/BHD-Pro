import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { ScheduledInvoicesService } from './scheduled-invoices.service';
import { ScheduledInvoicesController } from './scheduled-invoices.controller';

@Module({
  controllers: [
    InvoicesController,
    PurchaseOrdersController,
    ScheduledInvoicesController,
  ],
  providers: [InvoicesService, PurchaseOrdersService, ScheduledInvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
