import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
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
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
