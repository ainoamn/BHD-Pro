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
import { TaxRatesService } from './tax-rates.service';
import { TaxRateDto } from './dto/tax-rate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Tax Rates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tax-rates')
export class TaxRatesController {
  constructor(private service: TaxRatesService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@CurrentUser() user: TokenPayload, @Body() dto: TaxRateDto) {
    return this.service.create(user.companyId, dto);
  }

  @Put(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: Partial<TaxRateDto>,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/set-default')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Set tax rate as company default VAT' })
  setDefault(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.setDefault(user.companyId, id);
  }

  @Delete(':id')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
