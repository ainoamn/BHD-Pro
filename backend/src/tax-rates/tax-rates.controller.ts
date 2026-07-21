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
  create(@CurrentUser() user: TokenPayload, @Body() dto: TaxRateDto) {
    return this.service.create(user.companyId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: Partial<TaxRateDto>,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/set-default')
  @ApiOperation({ summary: 'Set tax rate as company default VAT' })
  setDefault(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.setDefault(user.companyId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
