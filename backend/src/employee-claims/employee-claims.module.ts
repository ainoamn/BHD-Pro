import { Module } from '@nestjs/common';
import { EmployeeClaimsService } from './employee-claims.service';
import { EmployeeClaimsController } from './employee-claims.controller';
import { JournalModule } from '../journal/journal.module';
import { DualControlModule } from '../dual-control/dual-control.module';

@Module({
  imports: [JournalModule, DualControlModule],
  controllers: [EmployeeClaimsController],
  providers: [EmployeeClaimsService],
  exports: [EmployeeClaimsService],
})
export class EmployeeClaimsModule {}
