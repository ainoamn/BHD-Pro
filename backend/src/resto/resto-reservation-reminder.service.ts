import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RestoService } from './resto.service';

/** Every 15 minutes: WhatsApp/SMS reminders for confirmed reservations in the remind window. */
@Injectable()
export class RestoReservationReminderService {
  private readonly logger = new Logger(RestoReservationReminderService.name);
  private running = false;

  constructor(private readonly resto: RestoService) {}

  @Cron('*/15 * * * *')
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.resto.processDueReservationReminders();
      if (result.sent > 0 || result.failed > 0) {
        this.logger.log(
          `Reservation reminders: sent=${result.sent} failed=${result.failed} scanned=${result.scanned}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Reservation reminder cron failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
