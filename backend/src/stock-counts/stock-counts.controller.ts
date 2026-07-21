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
import { StockCountsService } from './stock-counts.service';
import {
  CreateStockCountDto,
  UpdateStockCountLinesDto,
} from './dto/stock-count.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Stock Counts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stock-counts')
export class StockCountsController {
  constructor(private service: StockCountsService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.findOne(user.companyId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create stock count (seeds tracked products by default)' })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateStockCountDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Put(':id/lines')
  @ApiOperation({ summary: 'Update counted quantities' })
  updateLines(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStockCountLinesDto,
  ) {
    return this.service.updateLines(user.companyId, id, dto);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete count and apply stock variances' })
  complete(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.complete(user.companyId, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.cancel(user.companyId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
