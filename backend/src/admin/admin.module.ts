import { Module } from '@nestjs/common';
import { AdminController, PublicVisitsController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [PrismaModule, SubscriptionsModule],
  controllers: [AdminController, PublicVisitsController],
  providers: [AdminService, PlatformAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
