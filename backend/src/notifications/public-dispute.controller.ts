import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CustomerNotifyService } from './customer-notify.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

@ApiTags('Public Documents')
@Controller('public/documents')
export class PublicDisputeController {
  constructor(private customerNotify: CustomerNotifyService) {}

  @Post('c/:code/dispute')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Customer dispute report for a public verify-code document' })
  createDispute(@Param('code') code: string, @Body() dto: CreateDisputeDto) {
    return this.customerNotify.createDispute(code, dto);
  }
}
