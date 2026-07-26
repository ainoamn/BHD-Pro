import { Module } from '@nestjs/common';
import { AdminController, PublicVisitsController } from './admin.controller';
import { AdminService } from './admin.service';
import { SubscriptionReminderService } from './subscription-reminder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, SubscriptionsModule, NotificationsModule],
  controllers: [AdminController, PublicVisitsController],
  providers: [AdminService, PlatformAdminGuard, SubscriptionReminderService],
  exports: [AdminService],
})
export class AdminModule {}
