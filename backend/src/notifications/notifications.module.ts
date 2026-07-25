import { Module } from '@nestjs/common';
import { WhatsappNotifyService } from './whatsapp-notify.service';
import { CustomerNotifyService } from './customer-notify.service';
import { EmailNotifyService } from './email-notify.service';
import { PublicDisputeController } from './public-dispute.controller';
import { MessagingController } from './messaging.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [PublicDisputeController, MessagingController],
  providers: [WhatsappNotifyService, CustomerNotifyService, EmailNotifyService],
  exports: [WhatsappNotifyService, CustomerNotifyService, EmailNotifyService],
})
export class NotificationsModule {}
