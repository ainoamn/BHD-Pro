import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PosIncentivesService } from './pos-incentives.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { ProductsModule } from '../products/products.module';
import { PeriodsModule } from '../periods/periods.module';
import { DualControlModule } from '../dual-control/dual-control.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { JournalModule } from '../journal/journal.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    InvoicesModule,
    ProductsModule,
    PeriodsModule,
    DualControlModule,
    SubscriptionsModule,
    JournalModule,
    NotificationsModule,
    PaymentsModule,
  ],
  controllers: [PosController],
  providers: [PosService, PosIncentivesService],
  exports: [PosService, PosIncentivesService],
})
export class PosModule {}
