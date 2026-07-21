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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRateDto } from './dto/exchange-rate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Exchange Rates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private service: ExchangeRatesService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Get('convert')
  @ApiOperation({ summary: 'Convert amount using latest rate on or before date' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  @ApiQuery({ name: 'amount', required: true })
  @ApiQuery({ name: 'date', required: false })
  convert(
    @CurrentUser() user: TokenPayload,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('amount') amount: string,
    @Query('date') date?: string,
  ) {
    return this.service.convert(user.companyId, from, to, Number(amount), date);
  }

  @Post()
  create(@CurrentUser() user: TokenPayload, @Body() dto: ExchangeRateDto) {
    return this.service.create(user.companyId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: Partial<ExchangeRateDto>,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
