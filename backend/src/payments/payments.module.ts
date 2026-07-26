import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CompanyGatewaysService } from './company-gateways.service';
import { PlatformGatewaysService } from './platform-gateways.service';
import { PaymentsController, PlatformGatewaysController } from './payments.controller';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
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
