import { Module } from '@nestjs/common';
import { RestoController } from './resto.controller';
import { PublicRestoController } from './public-resto.controller';
import { RestoService } from './resto.service';
import { RestoDemoSeedService } from './resto-demo-seed.service';
import { PosModule } from '../pos/pos.module';
import { DualControlModule } from '../dual-control/dual-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';

@Module({
  imports: [
    PosModule,
    DualControlModule,
    NotificationsModule,
    SubscriptionsModule,
    InvoicesModule,
  ],
  controllers: [RestoController, PublicRestoController],
  providers: [
    RestoService,
    RestoDemoSeedService,
    PlanFeatureGuard,
    ModulePermissionGuard,
  ],
  exports: [RestoService],
})
export class RestoModule {}
