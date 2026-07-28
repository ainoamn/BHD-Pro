import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CompanyGatewaysService } from './company-gateways.service';
import { PlatformGatewaysService } from './platform-gateways.service';
import { PaymentsController, PlatformGatewaysController } from './payments.controller';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { RedisModule } from '../redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SubscriptionsModule, RedisModule, NotificationsModule],
  controllers: [PaymentsController, PlatformGatewaysController],
  providers: [
    PaymentsService,
    CompanyGatewaysService,
    PlatformGatewaysService,
    PlatformAdminGuard,
  ],
  exports: [PaymentsService, CompanyGatewaysService, PlatformGatewaysService],
})
export class PaymentsModule {}
