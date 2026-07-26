import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiPropertyOptional } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryNotesService } from './delivery-notes.service';
import { CreateDeliveryNoteDto } from './dto/create-delivery-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';
import { DualApprovalDto } from '../dual-control/dto/approval.dto';

class DeliveryStockDto {
  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

@ApiTags('Delivery Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('delivery-notes')
export class DeliveryNotesController {
  constructor(
    private service: DeliveryNotesService,
    private dualControl: DualControlService,
  ) {}

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
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateDeliveryNoteDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Post(':id/deliver')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Confirm delivery and deduct stock' })
  async deliver(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: DeliveryStockDto,
  ) {
    await this.dualControl.assertApproved(
      user.companyId,
      user,
      'STOCK_ADJUST',
      dto?.approval,
    );
    return this.service.deliver(user.companyId, id);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async cancel(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: DeliveryStockDto,
  ) {
    await this.dualControl.assertApproved(
      user.companyId,
      user,
      'STOCK_ADJUST',
      dto?.approval,
    );
    return this.service.cancel(user.companyId, id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
