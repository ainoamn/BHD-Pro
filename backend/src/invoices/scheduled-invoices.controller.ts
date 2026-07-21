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
import { ScheduledInvoicesService } from './scheduled-invoices.service';
import {
  CreateScheduledInvoiceDto,
  UpdateScheduledInvoiceDto,
} from './dto/procurement.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateScheduledInvoiceDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Post('process-due')
  @ApiOperation({ summary: 'Generate all due scheduled invoices (manual / cron)' })
  processDue() {
    return this.service.processDueSchedules();
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateScheduledInvoiceDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/toggle-active')
  @ApiOperation({ summary: 'Pause or resume a scheduled invoice' })
  toggleActive(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.toggleActive(user.companyId, id);
  }

  @Post(':id/generate')
  @ApiOperation({ summary: 'Generate sales invoice from schedule now' })
  generateNow(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.generateNow(user.companyId, user.sub, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
