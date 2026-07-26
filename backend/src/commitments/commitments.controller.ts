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
import { CommitmentsService } from './commitments.service';
import {
  CreateCommitmentDto,
  UpdateCommitmentDto,
  PauseCommitmentDto,
} from './dto/commitment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Recurring Commitments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('commitments')
export class CommitmentsController {
  constructor(private service: CommitmentsService) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Post('run-due')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Manually post due commitments for this company' })
  runDue(@CurrentUser() user: TokenPayload) {
    return this.service.runDue(user.companyId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.findOne(user.companyId, id);
  }

  @Post()
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateCommitmentDto) {
    return this.service.create(user.companyId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCommitmentDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause or defer commitment (day/month/year)' })
  pause(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: PauseCommitmentDto,
  ) {
    return this.service.pause(user.companyId, id, dto);
  }

  @Post(':id/resume')
  resume(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.resume(user.companyId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
