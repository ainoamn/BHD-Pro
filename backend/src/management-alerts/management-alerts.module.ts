import { Module } from '@nestjs/common';
import { ManagementAlertsService } from './management-alerts.service';
import { ManagementAlertsController } from './management-alerts.controller';

@Module({
  controllers: [ManagementAlertsController],
  providers: [ManagementAlertsService],
  exports: [ManagementAlertsService],
})
export class ManagementAlertsModule {}
