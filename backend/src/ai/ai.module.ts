import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ManagementAlertsModule } from '../management-alerts/management-alerts.module';
import { PosModule } from '../pos/pos.module';

@Module({
  imports: [ManagementAlertsModule, PosModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
