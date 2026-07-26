import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { RestoService } from './resto.service';
import { RestoDemoSeedService } from './resto-demo-seed.service';
import {
  ActivateRestoLinkDto,
  AddRestoOrderItemDto,
  AssignRestoSectionDto,
  AttachRestoLoyaltyDto,
  CloseRestoOrderDto,
  CreateRestoModifierDto,
  CreateRestoPayLinkDto,
  CreateRestoReservationDto,
  CreateRestoStationDto,
  CreateRestoTableDto,
  CreateRestoWaitlistDto,
  CreateRestoZoneDto,
  FireRestoCourseDto,
  IngestExternalRestoOrderDto,
  LinkRestoDto,
  MergeRestoOrderDto,
  OpenRestoOrderDto,
  SeedRestoFloorDto,
  SettleRestoBySeatDto,
  SettleRestoEqualDto,
  RestoKitchenRushDto,
  RestoKitchenHoldDto,
  RestoKitchenRecallDto,
  SetRestoMenu86Dto,
  SetRestoProductStationDto,
  SetRestoProductAllergensDto,
  SetRestoProductDietaryDto,
  SetRestoProductDayPartsDto,
  SetRestoProductDayPartPricesDto,
  SetRestoWarehouseDto,
  SplitRestoOrderDto,
  TransferRestoOrderDto,
  UpdateRestoConfigDto,
  UpdateRestoOrderDto,
  UpdateRestoOrderItemDto,
  UpdateRestoDeliveryDto,
  UpdateRestoWaitlistStatusDto,
  NotifyRestoReservationDto,
  UpsertRestoRecipeDto,
  UpdateRestoReservationStatusDto,
  VoidRestoOrderItemDto,
} from './dto/resto.dto';
import { IsIn } from 'class-validator';
import { PlanFeatureGuard } from '../common/guards/plan-feature.guard';
import { RequirePlanFeature } from '../common/decorators/require-plan-feature.decorator';
import { ModulePermissionGuard } from '../common/guards/module-permission.guard';

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
@UseGuards(JwtAuthGuard, RolesGuard, PlanFeatureGuard, ModulePermissionGuard)
@RequirePlanFeature('resto')
@Controller('resto')
export class RestoController {
  constructor(
    private readonly resto: RestoService,
    private readonly demoSeed: RestoDemoSeedService,
  ) {}

  @Get('link-status')
  @ApiOperation({ summary: 'Restaurant ↔ company link status' })
  linkStatus(@CurrentUser() user: TokenPayload) {
    return this.resto.getLinkStatus(user.companyId);
  }

  @Post('link/activate')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Activate restaurant link (SSO) + optional warehouse' })
  activate(
    @CurrentUser() user: TokenPayload,
    @Body() dto: ActivateRestoLinkDto,
  ) {
    return this.resto.activateLink(user.companyId, dto?.warehouseId);
  }

  @Post('link/warehouse')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Bind restaurants to a warehouse sector' })
  setWarehouse(
    @CurrentUser() user: TokenPayload,
    @Body() dto: SetRestoWarehouseDto,
  ) {
    return this.resto.setWarehouse(user.companyId, dto.warehouseId);
  }

  @Post('link/deactivate')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Deactivate restaurant link' })
  deactivate(@CurrentUser() user: TokenPayload) {
    return this.resto.deactivateLink(user.companyId);
  }

  @Post('link/generate')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate restaurant integration key' })
  generate(
    @CurrentUser() user: TokenPayload,
    @Body() dto: ActivateRestoLinkDto,
  ) {
    return this.resto.generateIntegrationKey(user.companyId, dto?.warehouseId);
  }

  @Post('link')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm restaurant link with key' })
  linkWithKey(@CurrentUser() user: TokenPayload, @Body() dto: LinkRestoDto) {
    return this.resto.linkWithKey(user.companyId, dto.key, dto.warehouseId);
  }

  @Get('menu')
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary:
      'Menu from linked restaurant warehouse (optional dayPart=now|breakfast|lunch|dinner|late)',
  })
  menu(
    @CurrentUser() user: TokenPayload,
    @Query('q') q?: string,
    @Query('dayPart') dayPart?: string,
  ) {
    return this.resto.getMenu(user.companyId, q, { dayPart: dayPart || null });
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

  @Post('demo/seed')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({
    summary:
      'Seed multi-branch demo: restaurants + cafe + grocery warehouses, meals with images, retail SKUs',
  })
  seedDemo(@CurrentUser() user: TokenPayload) {
    return this.demoSeed.seed(user.companyId);
  }

  @Post('demo/purge')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete DEMO-* branches/warehouses/products only' })
  purgeDemo(@CurrentUser() user: TokenPayload) {
    return this.demoSeed.purge(user.companyId);
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

  @Post('tables/guest-tokens')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Ensure guest QR tokens for all tables' })
  ensureGuestTokens(@CurrentUser() user: TokenPayload) {
    return this.resto.ensureGuestTokens(user.companyId);
  }

  @Post('tables/:id/clear-call')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Clear guest call-waiter flag on a table' })
  clearGuestCall(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
  ) {
    return this.resto.clearGuestCall(user.companyId, id);
  }

  @Post('orders')
  @Roles(...RESTO_STAFF)
  openOrder(
    @CurrentUser() user: TokenPayload,
    @Body() dto: OpenRestoOrderDto,
  ) {
    return this.resto.openOrder(user.companyId, user.sub, dto);
  }

  @Post('external/orders')
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary:
      'Ingest delivery/takeaway from aggregators (Talabat/Jahez/Careem) — idempotent by externalChannel+externalOrderId; supports x-api-key',
  })
  ingestExternal(
    @CurrentUser() user: TokenPayload,
    @Body() dto: IngestExternalRestoOrderDto,
  ) {
    return this.resto.ingestExternalOrder(user.companyId, user.sub, dto);
  }

  @Get('orders')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'List active floor/takeaway/delivery orders' })
  listOrders(
    @CurrentUser() user: TokenPayload,
    @Query('channel') channel?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY',
  ) {
    return this.resto.listActiveOrders(user.companyId, channel);
  }

  @Get('orders/:id')
  @Roles(...RESTO_STAFF)
  getOrder(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.resto.getOrder(user.companyId, id);
  }

  @Patch('orders/:id')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Update open order guests / notes' })
  updateOrder(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRestoOrderDto,
  ) {
    return this.resto.updateOrder(user.companyId, id, dto);
  }

  @Post('orders/:id/transfer')
  @Roles(...RESTO_STAFF)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Transfer open order to another free table' })
  transferOrder(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: TransferRestoOrderDto,
  ) {
    return this.resto.transferOrder(user.companyId, id, dto);
  }

  @Post('orders/:id/merge')
  @Roles(...RESTO_STAFF)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Merge this order into a target open order' })
  mergeOrder(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: MergeRestoOrderDto,
  ) {
    return this.resto.mergeOrders(user.companyId, id, dto);
  }

  @Post('orders/:id/split')
  @Roles(...RESTO_STAFF)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Split selected items onto a new check' })
  splitOrder(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: SplitRestoOrderDto,
  ) {
    return this.resto.splitOrder(user.companyId, id, user.sub, dto);
  }

  @Get('modifiers')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'List menu modifiers (seeds defaults if empty)' })
  listModifiers(@CurrentUser() user: TokenPayload) {
    return this.resto.listModifiers(user.companyId);
  }

  @Post('modifiers')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Create a menu modifier' })
  createModifier(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateRestoModifierDto,
  ) {
    return this.resto.createModifier(user.companyId, dto);
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

  @Post('orders/:id/items/:itemId/void')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Roles(...RESTO_FLOOR_MGR, UserRole.WAITER)
  @ApiOperation({ summary: 'Void or comp a sent kitchen line (reason required)' })
  voidItem(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: VoidRestoOrderItemDto,
  ) {
    return this.resto.voidItem(
      user.companyId,
      user,
      id,
      itemId,
      dto.reason,
      !!dto.comp,
      dto.approval,
    );
  }

  @Post('orders/:id/send')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Fire pending items to KDS (optional course filter)' })
  send(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto?: FireRestoCourseDto,
  ) {
    return this.resto.sendToKitchen(user.companyId, id, dto?.course);
  }

  @Post('orders/:id/close')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Roles(...RESTO_STAFF)
  close(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: CloseRestoOrderDto,
  ) {
    return this.resto.closeOrder(user.companyId, user, id, dto || {});
  }

  @Post('orders/:id/settle/by-seat')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary:
      'Pay one seat: split billable seat lines to a child check and close it',
  })
  settleBySeat(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: SettleRestoBySeatDto,
  ) {
    return this.resto.settleBySeat(user.companyId, user, id, dto);
  }

  @Post('orders/:id/settle/equal')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary: 'Equal N-way tender split on a single paid close',
  })
  settleEqual(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: SettleRestoEqualDto,
  ) {
    return this.resto.settleEqual(user.companyId, user, id, dto);
  }

  @Post('orders/:id/pay-link')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary: 'Create online pay link for table check (partner checkout)',
  })
  payLink(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: CreateRestoPayLinkDto,
  ) {
    return this.resto.createPayLink(user.companyId, user, id, dto || {});
  }

  @Patch('orders/:id/delivery')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Update delivery dispatch status / driver' })
  updateDelivery(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRestoDeliveryDto,
  ) {
    return this.resto.updateDeliveryStatus(user.companyId, id, dto);
  }

  @Post('orders/:id/cancel')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
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

  @Get('expo')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Expo / runner pass — READY items awaiting serve' })
  expo(@CurrentUser() user: TokenPayload) {
    return this.resto.getExpoQueue(user.companyId);
  }

  @Sse('kitchen/stream')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'SSE live kitchen queue (cookie auth)' })
  kitchenStream(
    @CurrentUser() user: TokenPayload,
    @Query('stationId') stationId?: string,
  ): Observable<MessageEvent> {
    return this.resto.kitchenStream(user.companyId, stationId) as Observable<MessageEvent>;
  }

  @Sse('expo/stream')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'SSE live expo / runner pass queue' })
  expoStream(
    @CurrentUser() user: TokenPayload,
  ): Observable<MessageEvent> {
    return this.resto.expoStream(user.companyId) as Observable<MessageEvent>;
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

  @Post('kitchen/items/:itemId/rush')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Toggle KDS rush priority on a ticket' })
  kitchenRush(
    @CurrentUser() user: TokenPayload,
    @Param('itemId') itemId: string,
    @Body() dto: RestoKitchenRushDto,
  ) {
    return this.resto.setKitchenItemRush(user.companyId, itemId, !!dto.rush);
  }

  @Post('kitchen/items/:itemId/hold')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Hold / release a KDS ticket' })
  kitchenHold(
    @CurrentUser() user: TokenPayload,
    @Param('itemId') itemId: string,
    @Body() dto: RestoKitchenHoldDto,
  ) {
    return this.resto.setKitchenItemHold(user.companyId, itemId, !!dto.hold);
  }

  @Post('kitchen/items/:itemId/recall')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Recall READY/SERVED ticket back to PREPARING or READY' })
  kitchenRecall(
    @CurrentUser() user: TokenPayload,
    @Param('itemId') itemId: string,
    @Body() dto: RestoKitchenRecallDto,
  ) {
    return this.resto.recallKitchenItem(user.companyId, itemId, dto.to);
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

  @Get('reports/flash')
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary: 'Business-day flash report for shift handover / print',
  })
  reportsFlash(@CurrentUser() user: TokenPayload) {
    return this.resto.getFlashReport(user.companyId);
  }

  @Get('reports/live')
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary:
      'Live section performance board (open checks + today’s closed KPIs)',
  })
  reportsLive(@CurrentUser() user: TokenPayload) {
    return this.resto.getLiveSectionBoard(user.companyId);
  }

  @Get('config')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Restaurant ops config (day-part schedules)' })
  getConfig(@CurrentUser() user: TokenPayload) {
    return this.resto.getRestoConfig(user.companyId);
  }

  @Put('config')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Update restaurant day-part hour windows' })
  updateConfig(
    @CurrentUser() user: TokenPayload,
    @Body() dto: UpdateRestoConfigDto,
  ) {
    return this.resto.updateRestoConfig(user.companyId, dto);
  }

  @Get('loyalty/lookup')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Lookup loyalty contact by phone' })
  loyaltyLookup(
    @CurrentUser() user: TokenPayload,
    @Query('phone') phone?: string,
  ) {
    if (!phone?.trim()) {
      return {
        found: false,
        phone: null,
        contactId: null,
        name: null,
        points: 0,
        customerEnabled: false,
        redeemEnabled: false,
      };
    }
    return this.resto.lookupLoyaltyByPhone(user.companyId, phone);
  }

  @Post('orders/:id/loyalty')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Attach or clear loyalty contact on an open order' })
  attachLoyalty(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AttachRestoLoyaltyDto,
  ) {
    return this.resto.attachLoyaltyToOrder(user.companyId, id, dto || {});
  }

  @Get('staff')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'List floor staff for tip assignee / sections' })
  listStaff(@CurrentUser() user: TokenPayload) {
    return this.resto.listRestoStaff(user.companyId);
  }

  @Get('sections/assignments')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'List active server ↔ zone section assignments' })
  listSections(@CurrentUser() user: TokenPayload) {
    return this.resto.listSectionAssignments(user.companyId);
  }

  @Put('sections/assignments')
  @Roles(...RESTO_FLOOR_MGR, UserRole.WAITER)
  @ApiOperation({ summary: 'Assign a server to a floor section (zone)' })
  assignSection(
    @CurrentUser() user: TokenPayload,
    @Body() dto: AssignRestoSectionDto,
  ) {
    return this.resto.assignSection(user.companyId, dto);
  }

  @Delete('sections/assignments/:zoneId')
  @Roles(...RESTO_FLOOR_MGR, UserRole.WAITER)
  @ApiOperation({ summary: 'Release active server from a floor section' })
  releaseSection(
    @CurrentUser() user: TokenPayload,
    @Param('zoneId') zoneId: string,
  ) {
    return this.resto.releaseSection(user.companyId, zoneId);
  }

  @Patch('menu/:productId/station')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Set default KDS station for a menu product' })
  setProductStation(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
    @Body() dto: SetRestoProductStationDto,
  ) {
    return this.resto.setProductStation(
      user.companyId,
      productId,
      dto.stationId || null,
    );
  }

  @Patch('menu/:productId/allergens')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Set EU14 allergen codes for a menu product' })
  setProductAllergens(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
    @Body() dto: SetRestoProductAllergensDto,
  ) {
    return this.resto.setProductAllergens(user.companyId, productId, dto);
  }

  @Patch('menu/:productId/dietary')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Set dietary tags (halal, vegan, spicy, …)' })
  setProductDietary(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
    @Body() dto: SetRestoProductDietaryDto,
  ) {
    return this.resto.setProductDietary(user.companyId, productId, dto);
  }

  @Patch('menu/:productId/day-parts')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({
    summary: 'Set day-part availability (empty = all day)',
  })
  setProductDayParts(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
    @Body() dto: SetRestoProductDayPartsDto,
  ) {
    return this.resto.setProductDayParts(user.companyId, productId, dto);
  }

  @Patch('menu/:productId/day-part-prices')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({
    summary: 'Set optional sale-price overrides per day-part',
  })
  setProductDayPartPrices(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
    @Body() dto: SetRestoProductDayPartPricesDto,
  ) {
    return this.resto.setProductDayPartPrices(user.companyId, productId, dto);
  }

  @Get('reservations')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'List upcoming reservations' })
  reservations(
    @CurrentUser() user: TokenPayload,
    @Query('days') days?: string,
  ) {
    const n = days ? Number(days) : 2;
    return this.resto.listReservations(
      user.companyId,
      Number.isFinite(n) ? n : 2,
    );
  }

  @Post('reservations')
  @Roles(...RESTO_FLOOR_MGR, UserRole.WAITER)
  @ApiOperation({ summary: 'Create reservation' })
  createReservation(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateRestoReservationDto,
  ) {
    return this.resto.createReservation(user.companyId, dto);
  }

  @Patch('reservations/:id/status')
  @Roles(...RESTO_FLOOR_MGR, UserRole.WAITER)
  @ApiOperation({ summary: 'Update reservation status' })
  updateReservationStatus(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRestoReservationStatusDto,
  ) {
    return this.resto.updateReservationStatus(
      user.companyId,
      id,
      dto.status,
      user.sub,
    );
  }

  @Get('recipes')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'List restaurant recipes (BOM)' })
  listRecipes(@CurrentUser() user: TokenPayload) {
    return this.resto.listRecipes(user.companyId);
  }

  @Get('recipes/:productId')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Get recipe for a menu product' })
  getRecipe(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
  ) {
    return this.resto.getRecipe(user.companyId, productId);
  }

  @Put('recipes/:productId')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Create or replace recipe for a menu product' })
  upsertRecipe(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
    @Body() dto: UpsertRestoRecipeDto,
  ) {
    return this.resto.upsertRecipe(user.companyId, productId, dto);
  }

  @Delete('recipes/:productId')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({ summary: 'Delete recipe for a menu product' })
  deleteRecipe(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
  ) {
    return this.resto.deleteRecipe(user.companyId, productId);
  }

  @Get('waitlist')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Active walk-in waitlist' })
  waitlist(@CurrentUser() user: TokenPayload) {
    return this.resto.listWaitlist(user.companyId);
  }

  @Post('waitlist')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Add guest to waitlist' })
  createWaitlist(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateRestoWaitlistDto,
  ) {
    return this.resto.createWaitlist(user.companyId, dto);
  }

  @Patch('waitlist/:id/status')
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary:
      'Update waitlist status (NOTIFIED sends WhatsApp/SMS when configured)',
  })
  updateWaitlistStatus(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRestoWaitlistStatusDto,
  ) {
    return this.resto.updateWaitlistStatus(
      user.companyId,
      id,
      user.sub,
      dto.status,
      dto.tableId,
    );
  }

  @Post('waitlist/:id/notify')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Re-send table-ready notify (WhatsApp/SMS)' })
  notifyWaitlist(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
  ) {
    return this.resto.notifyWaitlistGuest(user.companyId, id);
  }

  @Post('reservations/:id/notify')
  @Roles(...RESTO_STAFF)
  @ApiOperation({
    summary: 'Send reservation confirm / reminder / table-ready to guest',
  })
  notifyReservation(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: NotifyRestoReservationDto,
  ) {
    return this.resto.notifyReservationGuest(
      user.companyId,
      id,
      dto?.kind || 'CONFIRM',
    );
  }

  @Get('menu/86')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'List 86\'d (unavailable) menu items' })
  list86(@CurrentUser() user: TokenPayload) {
    return this.resto.listMenu86(user.companyId);
  }

  @Post('menu/86')
  @Roles(...RESTO_FLOOR_MGR, UserRole.WAITER, UserRole.KITCHEN)
  @ApiOperation({ summary: 'Mark menu item as 86 (unavailable)' })
  set86(
    @CurrentUser() user: TokenPayload,
    @Body() dto: SetRestoMenu86Dto,
  ) {
    return this.resto.setMenu86(user.companyId, dto);
  }

  @Delete('menu/86/:productId')
  @Roles(...RESTO_FLOOR_MGR, UserRole.WAITER, UserRole.KITCHEN)
  @ApiOperation({ summary: 'Clear 86 — item available again' })
  clear86(
    @CurrentUser() user: TokenPayload,
    @Param('productId') productId: string,
  ) {
    return this.resto.clearMenu86(user.companyId, productId);
  }

  @Post('menu/86/reconcile')
  @Roles(...RESTO_FLOOR_MGR)
  @ApiOperation({
    summary:
      'Reconcile auto-86 from recipe/warehouse stock (manual 86 untouched)',
  })
  reconcile86(@CurrentUser() user: TokenPayload) {
    return this.resto.reconcileAuto86(user.companyId);
  }
}
