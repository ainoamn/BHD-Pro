import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { RestoService } from './resto.service';
import {
  AddRestoOrderItemDto,
  CloseRestoOrderDto,
  CreateRestoStationDto,
  CreateRestoTableDto,
  CreateRestoZoneDto,
  LinkRestoDto,
  OpenRestoOrderDto,
  SeedRestoFloorDto,
  UpdateRestoOrderItemDto,
} from './dto/resto.dto';
import { IsIn } from 'class-validator';

class KitchenStatusDto {
  @IsIn(['PREPARING', 'READY', 'SERVED'])
  status!: 'PREPARING' | 'READY' | 'SERVED';
}

const RESTO_STAFF = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.RESTO_MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.CASHIER,
  UserRole.ACCOUNTANT,
] as const;

const RESTO_FLOOR_MGR = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.RESTO_MANAGER,
] as const;

@ApiTags('resto')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resto')
export class RestoController {
  constructor(private readonly resto: RestoService) {}

  @Get('link-status')
  @ApiOperation({ summary: 'Restaurant ↔ company link status' })
  linkStatus(@CurrentUser() user: TokenPayload) {
    return this.resto.getLinkStatus(user.companyId);
  }

  @Post('link/activate')
  @ApiOperation({ summary: 'Activate restaurant link (SSO)' })
  activate(@CurrentUser() user: TokenPayload) {
    return this.resto.activateLink(user.companyId);
  }

  @Post('link/deactivate')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Deactivate restaurant link' })
  deactivate(@CurrentUser() user: TokenPayload) {
    return this.resto.deactivateLink(user.companyId);
  }

  @Post('link/generate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate restaurant integration key' })
  generate(@CurrentUser() user: TokenPayload) {
    return this.resto.generateIntegrationKey(user.companyId);
  }

  @Post('link')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm restaurant link with key' })
  linkWithKey(@CurrentUser() user: TokenPayload, @Body() dto: LinkRestoDto) {
    return this.resto.linkWithKey(user.companyId, dto.key);
  }

  @Get('menu')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Active products as restaurant menu' })
  menu(@CurrentUser() user: TokenPayload, @Query('q') q?: string) {
    return this.resto.getMenu(user.companyId, q);
  }

  @Get('floor')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Floor zones and tables with open orders' })
  floor(@CurrentUser() user: TokenPayload) {
    return this.resto.getFloor(user.companyId);
  }

  @Post('floor/seed')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Seed default zone + tables if empty' })
  seedFloor(
    @CurrentUser() user: TokenPayload,
    @Body() dto: SeedRestoFloorDto,
  ) {
    return this.resto.seedFloor(user.companyId, dto.tableCount ?? 8);
  }

  @Post('zones')
  @Roles(...RESTO_FLOOR_MGR)
  createZone(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateRestoZoneDto,
  ) {
    return this.resto.createZone(user.companyId, dto);
  }

  @Post('tables')
  @Roles(...RESTO_FLOOR_MGR)
  createTable(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateRestoTableDto,
  ) {
    return this.resto.createTable(user.companyId, dto);
  }

  @Post('orders')
  @Roles(...RESTO_STAFF)
  openOrder(
    @CurrentUser() user: TokenPayload,
    @Body() dto: OpenRestoOrderDto,
  ) {
    return this.resto.openOrder(user.companyId, user.sub, dto);
  }

  @Get('orders/:id')
  @Roles(...RESTO_STAFF)
  getOrder(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.resto.getOrder(user.companyId, id);
  }

  @Post('orders/:id/items')
  @Roles(...RESTO_STAFF)
  addItem(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AddRestoOrderItemDto,
  ) {
    return this.resto.addItem(user.companyId, id, dto);
  }

  @Patch('orders/:id/items/:itemId')
  @Roles(...RESTO_STAFF)
  updateItem(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateRestoOrderItemDto,
  ) {
    return this.resto.updateItem(user.companyId, id, itemId, dto);
  }

  @Delete('orders/:id/items/:itemId')
  @Roles(...RESTO_STAFF)
  removeItem(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.resto.removeItem(user.companyId, id, itemId);
  }

  @Post('orders/:id/send')
  @Roles(...RESTO_STAFF)
  send(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.resto.sendToKitchen(user.companyId, id);
  }

  @Post('orders/:id/close')
  @Roles(...RESTO_STAFF)
  close(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: CloseRestoOrderDto,
  ) {
    return this.resto.closeOrder(user.companyId, user, id, dto || {});
  }

  @Post('orders/:id/cancel')
  @Roles(...RESTO_FLOOR_MGR)
  cancel(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.resto.cancelOrder(user.companyId, id);
  }

  @Get('stations')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'List kitchen stations' })
  stations(@CurrentUser() user: TokenPayload) {
    return this.resto.listStations(user.companyId);
  }

  @Post('stations')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Create kitchen station' })
  createStation(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateRestoStationDto,
  ) {
    return this.resto.createStation(user.companyId, dto);
  }

  @Get('kitchen')
  @Roles(...RESTO_STAFF)
  kitchen(
    @CurrentUser() user: TokenPayload,
    @Query('stationId') stationId?: string,
  ) {
    return this.resto.getKitchenQueue(user.companyId, stationId);
  }

  @Post('kitchen/items/:itemId/status')
  @Roles(...RESTO_STAFF)
  kitchenStatus(
    @CurrentUser() user: TokenPayload,
    @Param('itemId') itemId: string,
    @Body() dto: KitchenStatusDto,
  ) {
    return this.resto.setKitchenItemStatus(user.companyId, itemId, dto.status);
  }

  @Get('reports/summary')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Restaurant operational reports summary' })
  reportsSummary(
    @CurrentUser() user: TokenPayload,
    @Query('days') days?: string,
  ) {
    const n = days ? Number(days) : 7;
    return this.resto.getReportsSummary(
      user.companyId,
      Number.isFinite(n) ? n : 7,
    );
  }
}
