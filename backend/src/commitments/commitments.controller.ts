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
import { CommitmentsService } from './commitments.service';
import {
  CreateCommitmentDto,
  UpdateCommitmentDto,
  PauseCommitmentDto,
  ReverseCommitmentDto,
} from './dto/commitment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';

@ApiTags('Recurring Commitments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('commitments')
export class CommitmentsController {
  constructor(
    private service: CommitmentsService,
    private dualControl: DualControlService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Post('run-due')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
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
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateCommitmentDto) {
    return this.service.create(user.companyId, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCommitmentDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/pause')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Pause or defer commitment (day/month/year)' })
  pause(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: PauseCommitmentDto,
  ) {
    return this.service.pause(user.companyId, id, dto);
  }

  @Post(':id/resume')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  resume(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.resume(user.companyId, id);
  }

  @Post(':id/reverse-last')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Reverse the latest (or next unreversed) commitment accrual journal' })
  async reverseLast(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: ReverseCommitmentDto,
  ) {
    await this.dualControl.assertApproved(
      user.companyId,
      user,
      'COMMITMENT_REVERSE',
      dto?.approval,
    );
    return this.service.reverseLast(user.companyId, user.sub, id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
