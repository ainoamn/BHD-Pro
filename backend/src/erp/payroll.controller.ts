import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PayrollStatus } from '@prisma/client';
import { ErpService } from './erp.service';
import { CreatePayrollDto, UpdatePayrollStatusDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(
    private erp: ErpService,
    private dualControl: DualControlService,
  ) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findPayrollRuns(u.companyId);
  }
  @Post()
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  create(@CurrentUser() u: TokenPayload, @Body() dto: CreatePayrollDto) {
    return this.erp.createPayrollRun(u.companyId, dto);
  }
  @Patch(':id/status')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async updateStatus(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollStatusDto,
  ) {
    if (dto.status === PayrollStatus.PAID) {
      await this.dualControl.assertApproved(u.companyId, u, 'PAYROLL_PAY', dto.approval);
    }
    return this.erp.updatePayrollStatus(u.companyId, u.sub, id, dto.status, {
      bankAccountId: dto.bankAccountId,
      paymentMethod: dto.paymentMethod,
    });
  }
  @Delete(':id')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deletePayrollRun(u.companyId, id);
  }
}
