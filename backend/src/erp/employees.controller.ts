import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ErpService } from './erp.service';
import { EmployeeDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private erp: ErpService) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findEmployees(u.companyId);
  }
  @Post() create(@CurrentUser() u: TokenPayload, @Body() dto: EmployeeDto) {
    return this.erp.createEmployee(u.companyId, dto);
  }
  @Put(':id') update(@CurrentUser() u: TokenPayload, @Param('id') id: string, @Body() dto: Partial<EmployeeDto>) {
    return this.erp.updateEmployee(u.companyId, id, dto);
  }
  @Delete(':id') remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deleteEmployee(u.companyId, id);
  }
}
