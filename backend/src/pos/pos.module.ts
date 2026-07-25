import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';
import { InvoicesModule } from '../invoices/invoices.module';
import { ProductsModule } from '../products/products.module';
import { PeriodsModule } from '../periods/periods.module';
import { DualControlModule } from '../dual-control/dual-control.module';

@Module({
  imports: [InvoicesModule, ProductsModule, PeriodsModule, DualControlModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
