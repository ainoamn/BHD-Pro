import { Module } from '@nestjs/common';
import { AdminController, PublicVisitsController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminController, PublicVisitsController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
