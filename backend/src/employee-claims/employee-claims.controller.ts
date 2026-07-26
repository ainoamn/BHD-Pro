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
import { EmployeeClaimsService } from './employee-claims.service';
import {
  CreateEmployeeClaimDto,
  UpdateEmployeeClaimDto,
  RejectClaimDto,
  MarkClaimPaidDto,
} from './dto/employee-claim.dto';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';

@ApiTags('Employee Claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employee-claims')
export class EmployeeClaimsController {
  constructor(
    private service: EmployeeClaimsService,
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
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateEmployeeClaimDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeClaimDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/submit')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit claim for approval' })
  submit(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.submit(user.companyId, id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  approve(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.approve(user.companyId, user.sub, id);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  reject(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: RejectClaimDto,
  ) {
    return this.service.reject(user.companyId, user.sub, id, dto);
  }

  @Post(':id/pay')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Mark approved claim as paid/reimbursed' })
  async markPaid(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: MarkClaimPaidDto,
  ) {
    await this.dualControl.assertApproved(user.companyId, user, 'CLAIM_PAY', dto?.approval);
    return this.service.markPaid(user.companyId, user.sub, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
