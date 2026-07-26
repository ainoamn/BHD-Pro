import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { RestoService } from './resto.service';
import {
  PublicGuestCallDto,
  PublicGuestOrderDto,
  PublicGuestPayDto,
  PublicGuestLoyaltyDto,
  PublicCreateBookingDto,
} from './dto/resto.dto';

@ApiTags('Public Resto')
@Controller('public/resto')
export class PublicRestoController {
  constructor(private readonly resto: RestoService) {}

  @Get('t/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest QR session — menu + table + open check' })
  session(@Param('token') token: string) {
    return this.resto.getPublicGuestSession(token);
  }

  @Post('t/:token/items')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest adds items to the table check' })
  addItems(@Param('token') token: string, @Body() dto: PublicGuestOrderDto) {
    return this.resto.publicAddItems(token, dto);
  }

  @Post('t/:token/call')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest calls waiter / requests check / water' })
  call(@Param('token') token: string, @Body() dto: PublicGuestCallDto) {
    return this.resto.publicCallStaff(token, dto);
  }

  @Post('t/:token/pay')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest creates online pay link for the open check' })
  pay(@Param('token') token: string, @Body() dto: PublicGuestPayDto) {
    return this.resto.publicCreatePayLink(token, dto || {});
  }

  @Post('t/:token/loyalty')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Guest attaches phone for loyalty points on this table check',
  })
  loyalty(@Param('token') token: string, @Body() dto: PublicGuestLoyaltyDto) {
    return this.resto.publicAttachLoyalty(token, dto);
  }

  @Get('book/:slug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public online booking page (brand + rules)' })
  bookingPage(@Param('slug') slug: string) {
    return this.resto.getPublicBookingPage(slug);
  }

  @Get('book/:slug/availability')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'Available reservation slots for a date' })
  bookingAvailability(
    @Param('slug') slug: string,
    @Query('date') date: string,
    @Query('guests') guests?: string,
  ) {
    return this.resto.getPublicBookingAvailability(
      slug,
      date,
      Number(guests) || 2,
    );
  }

  @Post('book/:slug')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest creates a reservation online' })
  createBooking(
    @Param('slug') slug: string,
    @Body() dto: PublicCreateBookingDto,
  ) {
    return this.resto.createPublicBooking(slug, dto);
  }

  @Get('reservations/:token')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public reservation lookup by confirm token' })
  reservation(@Param('token') token: string) {
    return this.resto.getPublicReservation(token);
  }

  @Post('reservations/:token/confirm')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest confirms reservation via link' })
  confirmReservation(@Param('token') token: string) {
    return this.resto.publicConfirmReservation(token);
  }

  @Post('reservations/:token/cancel')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Guest cancels reservation via link' })
  cancelReservation(@Param('token') token: string) {
    return this.resto.publicCancelReservation(token);
  }
}
