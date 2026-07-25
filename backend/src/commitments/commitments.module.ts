import { Module } from '@nestjs/common';
import { CommitmentsService } from './commitments.service';
import { CommitmentsController } from './commitments.controller';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [JournalModule],
  controllers: [CommitmentsController],
  providers: [CommitmentsService],
  exports: [CommitmentsService],
})
export class CommitmentsModule {}
