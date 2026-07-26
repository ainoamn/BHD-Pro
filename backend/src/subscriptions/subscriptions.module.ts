import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlanCatalogService } from './plan-catalog.service';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, PlanCatalogService],
  exports: [SubscriptionsService, PlanCatalogService],
})
export class SubscriptionsModule {}
