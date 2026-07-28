import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { CustomerNotifyService } from './customer-notify.service';
import {
  ListDisputesQueryDto,
  UpdateDisputeStatusDto,
} from './dto/dispute-admin.dto';

@ApiTags('Customer Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('disputes')
export class DisputesController {
  constructor(private customerNotify: CustomerNotifyService) {}

  @Get()
  @ApiOperation({ summary: 'List customer dispute reports for this company' })
  list(
    @CurrentUser() user: TokenPayload,
    @Query() query: ListDisputesQueryDto,
  ) {
    return this.customerNotify.listDisputes(user.companyId, query.status);
  }

  @Patch(':id/status')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Update dispute status' })
  updateStatus(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDisputeStatusDto,
  ) {
    return this.customerNotify.updateDisputeStatus(
      user.companyId,
      id,
      dto.status,
    );
  }
}
