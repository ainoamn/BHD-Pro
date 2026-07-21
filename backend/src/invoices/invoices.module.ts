import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { ScheduledInvoicesService } from './scheduled-invoices.service';
import { ScheduledInvoicesController } from './scheduled-invoices.controller';
import { InvoicesSchedulerService } from './invoices-scheduler.service';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [JournalModule],
  controllers: [
    InvoicesController,
    PurchaseOrdersController,
    ScheduledInvoicesController,
  ],
  providers: [
    InvoicesService,
    PurchaseOrdersService,
    ScheduledInvoicesService,
    InvoicesSchedulerService,
  ],
  exports: [InvoicesService, ScheduledInvoicesService],
})
export class InvoicesModule {}
