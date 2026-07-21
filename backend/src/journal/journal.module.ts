import { Module } from '@nestjs/common';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { GlPostingService } from './gl-posting.service';
import { PeriodsModule } from '../periods/periods.module';

@Module({
  imports: [PeriodsModule],
  controllers: [JournalController],
  providers: [JournalService, GlPostingService],
  exports: [JournalService, GlPostingService],
})
export class JournalModule {}
