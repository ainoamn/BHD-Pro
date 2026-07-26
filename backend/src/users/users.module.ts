import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';

@Module({
  imports: [SubscriptionsModule],
  controllers: [UsersController],
  providers: [UsersService, ModulePermissionGuard],
})
export class UsersModule {}
