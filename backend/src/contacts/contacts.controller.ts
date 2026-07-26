import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AdjustStoreCreditDto } from './dto/adjust-store-credit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { ContactType, UserRole } from '@prisma/client';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private contactsService: ContactsService) {}

  @Get()
  @ApiQuery({ name: 'type', required: false, enum: ContactType })
  @ApiQuery({ name: 'q', required: false, description: 'Search by name, phone, or email' })
  @ApiOperation({ summary: 'List contacts (optional type + name/phone search)' })
  findAll(
    @CurrentUser() user: TokenPayload,
    @Query('type') type?: ContactType,
    @Query('q') q?: string,
  ) {
    return this.contactsService.findAll(user.companyId, type, q);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.contactsService.findOne(user.companyId, id);
  }

  @Post()
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateContactDto) {
    return this.contactsService.create(user.companyId, user.sub, dto);
  }

  @Post(':id/store-credit-adjust')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({
    summary: 'Top up or reduce customer store-credit wallet with GL posting to 2130',
  })
  adjustStoreCredit(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AdjustStoreCreditDto,
  ) {
    return this.contactsService.adjustStoreCredit(user.companyId, user.sub, id, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.contactsService.remove(user.companyId, id);
  }
}
