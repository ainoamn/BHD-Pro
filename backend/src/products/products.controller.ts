import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto, ReverseAdjustStockDto } from './dto/adjust-stock.dto';
import { TransferStockDto, ReverseTransferStockDto } from './dto/transfer-stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.productsService.findAll(user.companyId);
  }

  @Get('stats')
  getStats(@CurrentUser() user: TokenPayload) {
    return this.productsService.getStats(user.companyId);
  }

  @Get('next-codes')
  @ApiOperation({
    summary: 'Preview next auto SKU + EAN-13 barcode (phone + retail scanner compatible)',
  })
  nextCodes(@CurrentUser() user: TokenPayload) {
    return this.productsService.previewNextCodes(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.productsService.findOne(user.companyId, id);
  }

  @Get(':id/movements')
  @ApiOperation({ summary: 'List recent stock movements for a product' })
  listMovements(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.productsService.listMovements(user.companyId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.companyId, dto);
  }

  @Post(':id/adjust')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Adjust product stock (IN / OUT / SET)' })
  adjust(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.productsService.adjustStock(user.companyId, id, dto, user);
  }

  @Post(':id/adjust/reverse-last')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Reverse the latest stock adjustment for a product' })
  reverseLastAdjust(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: ReverseAdjustStockDto,
  ) {
    return this.productsService.reverseLastAdjust(
      user.companyId,
      id,
      user,
      dto?.approval,
    );
  }

  @Post(':id/transfer')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Transfer product stock between warehouses' })
  transfer(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: TransferStockDto,
  ) {
    return this.productsService.transferStock(user.companyId, id, dto, user);
  }

  @Post(':id/transfer/reverse-last')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Reverse the latest warehouse transfer for a product' })
  reverseLastTransfer(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: ReverseTransferStockDto,
  ) {
    return this.productsService.reverseLastTransfer(
      user.companyId,
      id,
      user,
      dto?.approval,
    );
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.productsService.remove(user.companyId, id);
  }
}
