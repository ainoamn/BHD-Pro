import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CompanyGatewaysService } from './company-gateways.service';
import { PlatformGatewaysService } from './platform-gateways.service';
import { PaymentsController, PlatformGatewaysController } from './payments.controller';

@Module({
  controllers: [PaymentsController, PlatformGatewaysController],
  providers: [PaymentsService, CompanyGatewaysService, PlatformGatewaysService],
  exports: [PaymentsService, CompanyGatewaysService, PlatformGatewaysService],
})
export class PaymentsModule {}
