import { Module } from '@nestjs/common';
import { DualControlService } from './dual-control.service';
import { DualControlController } from './dual-control.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [DualControlController],
  providers: [DualControlService],
  exports: [DualControlService, NotificationsModule],
})
export class DualControlModule {}
