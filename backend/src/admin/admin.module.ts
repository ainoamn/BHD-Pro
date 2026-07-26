import { Module } from '@nestjs/common';
import { AdminController, PublicVisitsController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController, PublicVisitsController],
  providers: [AdminService, PlatformAdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
