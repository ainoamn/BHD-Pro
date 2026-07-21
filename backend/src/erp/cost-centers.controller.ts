import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ErpService } from './erp.service';
import { CostCenterDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Cost Centers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cost-centers')
export class CostCentersController {
  constructor(private erp: ErpService) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findCostCenters(u.companyId);
  }
  @Post() create(@CurrentUser() u: TokenPayload, @Body() dto: CostCenterDto) {
    return this.erp.createCostCenter(u.companyId, dto);
  }
  @Put(':id') update(@CurrentUser() u: TokenPayload, @Param('id') id: string, @Body() dto: Partial<CostCenterDto>) {
    return this.erp.updateCostCenter(u.companyId, id, dto);
  }
  @Delete(':id') remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deleteCostCenter(u.companyId, id);
  }
}
