import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { PosService } from './pos.service';
import { CreatePosSaleDto, LinkPosDto } from './dto/pos.dto';

@ApiTags('POS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate technical integration key (ADMIN, shown once)' })
  generate(@CurrentUser() user: TokenPayload) {
    return this.pos.generateIntegrationKey(user.companyId);
  }

  @Post('link')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm link with integration key (ADMIN, same company)' })
  linkWithKey(@CurrentUser() user: TokenPayload, @Body() dto: LinkPosDto) {
    return this.pos.linkWithKey(user.companyId, dto.key);
  }

  @Get('products/lookup')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Lookup product by barcode or SKU' })
  lookup(
    @CurrentUser() user: TokenPayload,
    @Query('code') code: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.pos.lookupProduct(user.companyId, code || '', warehouseId);
  }

  @Get('products/search')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @ApiOperation({ summary: 'Search POS catalog' })
  search(
    @CurrentUser() user: TokenPayload,
    @Query('q') q?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.pos.searchProducts(user.companyId, q || '', warehouseId);
  }

  @Post('sales')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Complete POS cash sale (stock reserve then invoice)' })
  sale(@CurrentUser() user: TokenPayload, @Body() dto: CreatePosSaleDto) {
    return this.pos.createSale(user.companyId, user.sub, dto);
  }
}
