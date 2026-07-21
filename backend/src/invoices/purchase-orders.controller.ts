import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/procurement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { PurchaseOrderStatus } from '@prisma/client';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private service: PurchaseOrdersService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.findOne(user.companyId, id);
  }

  @Post()
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreatePurchaseOrderDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body('status') status: PurchaseOrderStatus,
  ) {
    return this.service.updateStatus(user.companyId, id, status);
  }

  @Post(':id/convert')
  @ApiOperation({ summary: 'Convert purchase order to purchase invoice' })
  convertToInvoice(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.convertToInvoice(user.companyId, user.sub, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
