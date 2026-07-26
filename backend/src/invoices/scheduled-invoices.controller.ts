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
import { ScheduledInvoicesService } from './scheduled-invoices.service';
import {
  CreateScheduledInvoiceDto,
  UpdateScheduledInvoiceDto,
} from './dto/procurement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Scheduled Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('scheduled-invoices')
export class ScheduledInvoicesController {
  constructor(private service: ScheduledInvoicesService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.findOne(user.companyId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateScheduledInvoiceDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Post('process-due')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Generate due scheduled invoices for the current company only',
  })
  processDue(@CurrentUser() user: TokenPayload) {
    return this.service.processDueSchedules(user.companyId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateScheduledInvoiceDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Pause or resume a scheduled invoice' })
  toggleActive(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.toggleActive(user.companyId, id);
  }

  @Post(':id/generate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate sales invoice from schedule now' })
  generateNow(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.generateNow(user.companyId, user.sub, id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
