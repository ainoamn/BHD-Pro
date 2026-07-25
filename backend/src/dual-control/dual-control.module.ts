import { Module } from '@nestjs/common';
import { DualControlService } from './dual-control.service';
import { DualControlController } from './dual-control.controller';

@Module({
  controllers: [DualControlController],
  providers: [DualControlService],
  exports: [DualControlService],
})
export class DualControlModule {}
