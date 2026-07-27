import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [SubscriptionsModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService, ModulePermissionGuard],
})
export class UsersModule {}
