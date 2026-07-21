import { Module } from '@nestjs/common';
import { FxRevaluationService } from './fx-revaluation.service';
import { FxRevaluationController } from './fx-revaluation.controller';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [ExchangeRatesModule, JournalModule],
  controllers: [FxRevaluationController],
  providers: [FxRevaluationService],
})
export class FxRevaluationModule {}
