import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ErpService } from './erp.service';
import { WarehouseDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('warehouses')
export class WarehousesController {
  constructor(private erp: ErpService) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findWarehouses(u.companyId);
  }

  @Post() create(@CurrentUser() u: TokenPayload, @Body() dto: WarehouseDto) {
    return this.erp.createWarehouse(u.companyId, dto);
  }

  @Put(':id') update(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Body() dto: Partial<WarehouseDto>,
  ) {
    return this.erp.updateWarehouse(u.companyId, id, dto);
  }

  @Delete(':id') remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deleteWarehouse(u.companyId, id);
  }
}
