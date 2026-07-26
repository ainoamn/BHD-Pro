import { Module } from '@nestjs/common';
import { FxRevaluationService } from './fx-revaluation.service';
import { FxRevaluationController } from './fx-revaluation.controller';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { JournalModule } from '../journal/journal.module';
import { DualControlModule } from '../dual-control/dual-control.module';

@Module({
  imports: [ExchangeRatesModule, JournalModule, DualControlModule],
  controllers: [FxRevaluationController],
  providers: [FxRevaluationService],
})
export class FxRevaluationModule {}
