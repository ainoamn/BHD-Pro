import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ManagementAlertsModule } from '../management-alerts/management-alerts.module';
import { PosModule } from '../pos/pos.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';

@Module({
  imports: [ManagementAlertsModule, PosModule, SubscriptionsModule],
  controllers: [AiController],
  providers: [AiService, PlanFeatureGuard],
})
export class AiModule {}
