import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ErpService } from './erp.service';
import { CreatePayrollDto, UpdatePayrollStatusDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private erp: ErpService) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findPayrollRuns(u.companyId);
  }
  @Post() create(@CurrentUser() u: TokenPayload, @Body() dto: CreatePayrollDto) {
    return this.erp.createPayrollRun(u.companyId, dto);
  }
  @Patch(':id/status') updateStatus(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollStatusDto,
  ) {
    return this.erp.updatePayrollStatus(u.companyId, id, dto.status);
  }
  @Delete(':id') remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deletePayrollRun(u.companyId, id);
  }
}
