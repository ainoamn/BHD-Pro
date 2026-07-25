import { Module } from '@nestjs/common';
import { RestoController } from './resto.controller';
import { RestoService } from './resto.service';
import { RestoDemoSeedService } from './resto-demo-seed.service';
import { PosModule } from '../pos/pos.module';

@Module({
  imports: [PosModule],
  controllers: [RestoController],
  providers: [RestoService, RestoDemoSeedService],
  exports: [RestoService],
})
export class RestoModule {}
