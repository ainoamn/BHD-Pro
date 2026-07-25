import { Module } from '@nestjs/common';
import { DualControlService } from './dual-control.service';
import { DualControlController } from './dual-control.controller';
import { WhatsappNotifyService } from './whatsapp-notify.service';

@Module({
  controllers: [DualControlController],
  providers: [DualControlService, WhatsappNotifyService],
  exports: [DualControlService, WhatsappNotifyService],
})
export class DualControlModule {}
