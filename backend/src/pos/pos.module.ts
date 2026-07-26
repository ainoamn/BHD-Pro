import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { PosIncentivesService } from './pos-incentives.service';
import { TerminalTapService } from './terminal-tap.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { ProductsModule } from '../products/products.module';
import { PeriodsModule } from '../periods/periods.module';
import { DualControlModule } from '../dual-control/dual-control.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { JournalModule } from '../journal/journal.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuditModule } from '../audit/audit.module';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';

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
    AuditModule,
  ],
  controllers: [PosController],
  providers: [
    PosService,
    PosIncentivesService,
    TerminalTapService,
    PlanFeatureGuard,
    ModulePermissionGuard,
  ],
  exports: [PosService, PosIncentivesService, TerminalTapService],
})
export class PosModule {}
