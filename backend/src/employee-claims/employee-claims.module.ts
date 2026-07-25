import { Module } from '@nestjs/common';
import { EmployeeClaimsService } from './employee-claims.service';
import { EmployeeClaimsController } from './employee-claims.controller';
import { JournalModule } from '../journal/journal.module';

@Module({
  imports: [JournalModule],
  controllers: [EmployeeClaimsController],
  providers: [EmployeeClaimsService],
  exports: [EmployeeClaimsService],
})
export class EmployeeClaimsModule {}
