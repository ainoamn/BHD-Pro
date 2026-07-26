import { Module } from '@nestjs/common';
import { StockCountsService } from './stock-counts.service';
import { StockCountsController } from './stock-counts.controller';
import { DualControlModule } from '../dual-control/dual-control.module';

@Module({
  imports: [DualControlModule],
  controllers: [StockCountsController],
  providers: [StockCountsService],
  exports: [StockCountsService],
})
export class StockCountsModule {}
