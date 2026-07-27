import { Module } from '@nestjs/common';
import { ManagerReportsController } from './manager-reports.controller';
import { ManagerReportsService } from './manager-reports.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ManagementAlertsModule } from '../management-alerts/management-alerts.module';

@Module({
  imports: [NotificationsModule, ManagementAlertsModule],
  controllers: [ManagerReportsController],
  providers: [ManagerReportsService],
})
export class ManagerReportsModule {}
