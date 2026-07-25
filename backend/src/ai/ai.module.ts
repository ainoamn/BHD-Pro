import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ManagementAlertsModule } from '../management-alerts/management-alerts.module';

@Module({
  imports: [ManagementAlertsModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
