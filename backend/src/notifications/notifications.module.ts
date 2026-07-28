import { Module } from '@nestjs/common';
import { WhatsappNotifyService } from './whatsapp-notify.service';
import { CustomerNotifyService } from './customer-notify.service';
import { EmailNotifyService } from './email-notify.service';
import { SmsNotifyService } from './sms-notify.service';
import { RestoGuestNotifyService } from './resto-guest-notify.service';
import { PublicDisputeController } from './public-dispute.controller';
import { MessagingController } from './messaging.controller';
import { StorageModule } from '../storage/storage.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [StorageModule, RedisModule],
  controllers: [PublicDisputeController, MessagingController],
  providers: [
    WhatsappNotifyService,
    CustomerNotifyService,
    EmailNotifyService,
    SmsNotifyService,
    RestoGuestNotifyService,
  ],
  exports: [
    WhatsappNotifyService,
    CustomerNotifyService,
    EmailNotifyService,
    SmsNotifyService,
    RestoGuestNotifyService,
  ],
})
export class NotificationsModule {}
