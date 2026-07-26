import { Module } from '@nestjs/common';
import { CommitmentsService } from './commitments.service';
import { CommitmentsController } from './commitments.controller';
import { JournalModule } from '../journal/journal.module';
import { DualControlModule } from '../dual-control/dual-control.module';

@Module({
  imports: [JournalModule, DualControlModule],
  controllers: [CommitmentsController],
  providers: [CommitmentsService],
  exports: [CommitmentsService],
})
export class CommitmentsModule {}
