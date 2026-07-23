import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { PosService } from './pos.service';
import { CreatePosSaleDto, LinkPosDto } from './dto/pos.dto';

@ApiTags('POS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pos')
export class PosController {
  constructor(private pos: PosService) {}

  @Get('link-status')
  @ApiOperation({ summary: 'Accounting ↔ POS link status for company' })
  linkStatus(@CurrentUser() user: TokenPayload) {
    return this.pos.getLinkStatus(user.companyId);
  }

  @Post('link/activate')
  @ApiOperation({ summary: 'Link POS to Accounting via shared login session' })
  activate(@CurrentUser() user: TokenPayload) {
    return this.pos.activateLink(user.companyId);
  }

  @Post('link/generate')
  @ApiOperation({ summary: 'Generate technical integration key (shown once)' })
  generate(@CurrentUser() user: TokenPayload) {
    return this.pos.generateIntegrationKey(user.companyId);
  }

  @Post('link')
  @ApiOperation({ summary: 'Confirm link with integration key' })
  linkWithKey(@CurrentUser() user: TokenPayload, @Body() dto: LinkPosDto) {
    return this.pos.linkWithKey(user.companyId, dto.key);
  }

  @Get('products/lookup')
  @ApiOperation({ summary: 'Lookup product by barcode or SKU' })
  lookup(@CurrentUser() user: TokenPayload, @Query('code') code: string) {
    return this.pos.lookupProduct(user.companyId, code || '');
  }

  @Get('products/search')
  @ApiOperation({ summary: 'Search POS catalog' })
  search(@CurrentUser() user: TokenPayload, @Query('q') q?: string) {
    return this.pos.searchProducts(user.companyId, q || '');
  }

  @Post('sales')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Complete POS cash sale (invoice + stock OUT)' })
  sale(@CurrentUser() user: TokenPayload, @Body() dto: CreatePosSaleDto) {
    return this.pos.createSale(user.companyId, user.sub, dto);
  }
}
