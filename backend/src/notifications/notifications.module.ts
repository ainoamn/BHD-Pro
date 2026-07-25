import { Module } from '@nestjs/common';
import { WhatsappNotifyService } from './whatsapp-notify.service';
import { CustomerNotifyService } from './customer-notify.service';
import { EmailNotifyService } from './email-notify.service';
import { SmsNotifyService } from './sms-notify.service';
import { PublicDisputeController } from './public-dispute.controller';
import { MessagingController } from './messaging.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [PublicDisputeController, MessagingController],
  providers: [
    WhatsappNotifyService,
    CustomerNotifyService,
    EmailNotifyService,
    SmsNotifyService,
  ],
  exports: [
    WhatsappNotifyService,
    CustomerNotifyService,
    EmailNotifyService,
    SmsNotifyService,
  ],
})
export class NotificationsModule {}
