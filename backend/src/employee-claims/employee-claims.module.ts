import { Module } from '@nestjs/common';
import { EmployeeClaimsService } from './employee-claims.service';
import { EmployeeClaimsController } from './employee-claims.controller';

@Module({
  controllers: [EmployeeClaimsController],
  providers: [EmployeeClaimsService],
  exports: [EmployeeClaimsService],
})
export class EmployeeClaimsModule {}
