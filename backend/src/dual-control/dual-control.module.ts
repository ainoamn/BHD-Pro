import { Module } from '@nestjs/common';
import { DualControlService } from './dual-control.service';

@Module({
  providers: [DualControlService],
  exports: [DualControlService],
})
export class DualControlModule {}
