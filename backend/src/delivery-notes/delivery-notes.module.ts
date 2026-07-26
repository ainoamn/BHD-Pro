import { Module } from '@nestjs/common';
import { DeliveryNotesService } from './delivery-notes.service';
import { DeliveryNotesController } from './delivery-notes.controller';
import { DualControlModule } from '../dual-control/dual-control.module';

@Module({
  imports: [DualControlModule],
  controllers: [DeliveryNotesController],
  providers: [DeliveryNotesService],
  exports: [DeliveryNotesService],
})
export class DeliveryNotesModule {}
