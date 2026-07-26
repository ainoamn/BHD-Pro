import { Module } from '@nestjs/common';
import { RestoController } from './resto.controller';
import { PublicRestoController } from './public-resto.controller';
import { RestoService } from './resto.service';
import { RestoDemoSeedService } from './resto-demo-seed.service';
import { PosModule } from '../pos/pos.module';
import { DualControlModule } from '../dual-control/dual-control.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';

@Module({
  imports: [PosModule, DualControlModule, NotificationsModule, SubscriptionsModule],
  controllers: [RestoController, PublicRestoController],
  providers: [RestoService, RestoDemoSeedService, PlanFeatureGuard],
  exports: [RestoService],
})
export class RestoModule {}
