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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.companyId, dto);
  }

  @Post(':id/adjust')
  @ApiOperation({ summary: 'Adjust product stock (IN / OUT / SET)' })
  adjust(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.productsService.adjustStock(user.companyId, id, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.companyId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.productsService.remove(user.companyId, id);
  }
}
