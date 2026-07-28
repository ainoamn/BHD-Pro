import { Module } from '@nestjs/common';
import { DeliveryNotesService } from './delivery-notes.service';
import { DeliveryNotesController } from './delivery-notes.controller';
import { DualControlModule } from '../dual-control/dual-control.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [DualControlModule, RedisModule],
  controllers: [DeliveryNotesController],
  providers: [DeliveryNotesService],
  exports: [DeliveryNotesService],
})
export class DeliveryNotesModule {}
