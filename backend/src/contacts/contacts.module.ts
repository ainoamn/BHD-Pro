import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [SubscriptionsModule, JournalModule],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
