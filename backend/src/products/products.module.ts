import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { PeriodsModule } from '../periods/periods.module';
import { DualControlModule } from '../dual-control/dual-control.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ManagementAlertsModule } from '../management-alerts/management-alerts.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PeriodsModule,
    DualControlModule,
    SubscriptionsModule,
    ManagementAlertsModule,
    RedisModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
