import { Module } from '@nestjs/common';
import { RestoController } from './resto.controller';
import { PublicRestoController } from './public-resto.controller';
import { RestoService } from './resto.service';
import { RestoDemoSeedService } from './resto-demo-seed.service';
import { PosModule } from '../pos/pos.module';
import { DualControlModule } from '../dual-control/dual-control.module';

@Module({
  imports: [PosModule, DualControlModule],
  controllers: [RestoController, PublicRestoController],
  providers: [RestoService, RestoDemoSeedService],
  exports: [RestoService],
})
export class RestoModule {}
