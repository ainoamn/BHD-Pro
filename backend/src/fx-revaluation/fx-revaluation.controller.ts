import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FxRevaluationService } from './fx-revaluation.service';
import { PostFxRevaluationDto } from './dto/post-fx-revaluation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('FX Revaluation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fx-revaluation')
export class FxRevaluationController {
  constructor(private service: FxRevaluationService) {}

  @Get('preview')
  @ApiOperation({ summary: 'Preview unrealized FX gain/loss on open foreign invoices' })
  @ApiQuery({ name: 'asOf', required: false })
  preview(@CurrentUser() user: TokenPayload, @Query('asOf') asOf?: string) {
    return this.service.preview(user.companyId, asOf);
  }

  @Post('post')
  @ApiOperation({ summary: 'Post FX revaluation journal for as-of date' })
  post(@CurrentUser() user: TokenPayload, @Body() dto: PostFxRevaluationDto) {
    return this.service.post(user.companyId, user.sub, dto);
  }
}
