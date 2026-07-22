import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { ScheduledInvoicesService } from './scheduled-invoices.service';
import { ScheduledInvoicesController } from './scheduled-invoices.controller';
import { InvoicesSchedulerService } from './invoices-scheduler.service';
import { DocumentShareService } from './document-share.service';
import { PublicDocumentsController } from './public-documents.controller';
import { JournalModule } from '../journal/journal.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PeriodsModule } from '../periods/periods.module';

@Module({
  imports: [
    JournalModule,
    SubscriptionsModule,
    PeriodsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    InvoicesController,
    PurchaseOrdersController,
    ScheduledInvoicesController,
    PublicDocumentsController,
  ],
  providers: [
    InvoicesService,
    PurchaseOrdersService,
    ScheduledInvoicesService,
    InvoicesSchedulerService,
    DocumentShareService,
  ],
  exports: [InvoicesService, ScheduledInvoicesService, DocumentShareService],
})
export class InvoicesModule {}
