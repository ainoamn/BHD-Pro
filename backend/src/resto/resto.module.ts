import { Module } from '@nestjs/common';
import { RestoController } from './resto.controller';
import { RestoService } from './resto.service';

@Module({
  controllers: [RestoController],
  providers: [RestoService],
  exports: [RestoService],
})
export class RestoModule {}
