import { Module } from '@nestjs/common';
import { ErpService } from './erp.service';
import { JournalModule } from '../journal/journal.module';
import { BranchesController } from './branches.controller';
import { CostCentersController } from './cost-centers.controller';
import { ProjectsController } from './projects.controller';
import { EmployeesController } from './employees.controller';
import { AssetsController } from './assets.controller';
import { BankAccountsController } from './bank-accounts.controller';
import { WarehousesController } from './warehouses.controller';
import { PayrollController } from './payroll.controller';

@Module({
  imports: [JournalModule],
  controllers: [
    BranchesController,
    CostCentersController,
    ProjectsController,
    EmployeesController,
    AssetsController,
    BankAccountsController,
    WarehousesController,
    PayrollController,
  ],
  providers: [ErpService],
  exports: [ErpService],
})
export class ErpModule {}
