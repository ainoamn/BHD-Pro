import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledInvoicesService } from './scheduled-invoices.service';

@Injectable()
export class InvoicesSchedulerService {
  private readonly logger = new Logger(InvoicesSchedulerService.name);

  constructor(private scheduledInvoices: ScheduledInvoicesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async runDailySchedules() {
    this.logger.log('Processing due scheduled invoices...');
    const result = await this.scheduledInvoices.processDueSchedules();
    this.logger.log(`Scheduled invoices processed: ${result.generated}`);
  }
}
