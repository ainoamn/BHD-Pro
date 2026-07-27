import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { ContactsModule } from './contacts/contacts.module';
import { InvoicesModule } from './invoices/invoices.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { JournalModule } from './journal/journal.module';
import { ProductsModule } from './products/products.module';
import { ReportsModule } from './reports/reports.module';
import { CompaniesModule } from './companies/companies.module';
import { UsersModule } from './users/users.module';
import { VatModule } from './vat/vat.module';
import { AiModule } from './ai/ai.module';
import { PaymentsModule } from './payments/payments.module';
import { AccountsModule } from './accounts/accounts.module';
import { ErpModule } from './erp/erp.module';
import { PeriodsModule } from './periods/periods.module';
import { AuditModule } from './audit/audit.module';
import { TaxRatesModule } from './tax-rates/tax-rates.module';
import { DeliveryNotesModule } from './delivery-notes/delivery-notes.module';
import { StockCountsModule } from './stock-counts/stock-counts.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { EmployeeClaimsModule } from './employee-claims/employee-claims.module';
import { DocumentTemplatesModule } from './document-templates/document-templates.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { ExchangeRatesModule } from './exchange-rates/exchange-rates.module';
import { FxRevaluationModule } from './fx-revaluation/fx-revaluation.module';
import { AdminModule } from './admin/admin.module';
import { PosModule } from './pos/pos.module';
import { RestoModule } from './resto/resto.module';
import { DualControlModule } from './dual-control/dual-control.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CommitmentsModule } from './commitments/commitments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { ManagementAlertsModule } from './management-alerts/management-alerts.module';
import { ManagerReportsModule } from './manager-reports/manager-reports.module';
import { HealthController } from './health.controller';
import { DenyViewerMutationsGuard } from './common/guards/deny-viewer-mutations.guard';
import { Past2faGraceInterceptor } from './common/interceptors/past-2fa-grace.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    RedisModule,
    StorageModule,
    ThrottlerModule.forRootAsync({
      useFactory: () => {
        const redisUrl = (process.env.REDIS_URL || '').trim();
        const throttlers = [
          {
            name: 'default',
            ttl: 60_000,
            limit: 120,
          },
        ];
        if (redisUrl) {
          return {
            throttlers,
            storage: new ThrottlerStorageRedisService(redisUrl),
          };
        }
        return { throttlers };
      },
    }),
    PrismaModule,
    AuthModule,
    DashboardModule,
    ContactsModule,
    InvoicesModule,
    JournalModule,
    ProductsModule,
    ReportsModule,
    CompaniesModule,
    UsersModule,
    VatModule,
    AiModule,
    SubscriptionsModule,
    PaymentsModule,
    AccountsModule,
    ErpModule,
    PeriodsModule,
    AuditModule,
    TaxRatesModule,
    DeliveryNotesModule,
    StockCountsModule,
    ApiKeysModule,
    EmployeeClaimsModule,
    DocumentTemplatesModule,
    CustomFieldsModule,
    ExchangeRatesModule,
    FxRevaluationModule,
    AdminModule,
    PosModule,
    RestoModule,
    DualControlModule,
    NotificationsModule,
    CommitmentsModule,
    AttachmentsModule,
    ManagementAlertsModule,
    ManagerReportsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: DenyViewerMutationsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: Past2faGraceInterceptor,
    },
  ],
})
export class AppModule {}
