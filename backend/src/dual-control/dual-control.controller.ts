import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from './dual-control.service';
import {
  CreateApprovalRequestDto,
  DecideApprovalRequestDto,
  RequestWhatsappOtpDto,
} from './dto/approval.dto';

@ApiTags('Dual control')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dual-control')
export class DualControlController {
  constructor(private dualControl: DualControlService) {}

  @Post('whatsapp-otp')
  @ApiOperation({ summary: 'Send WhatsApp OTP for a dual-control action' })
  requestWhatsappOtp(
    @CurrentUser() user: TokenPayload,
    @Body() dto: RequestWhatsappOtpDto,
  ) {
    return this.dualControl.requestWhatsappOtp(
      user.companyId,
      { sub: user.sub, role: user.role, email: user.email },
      dto.action,
    );
  }

  @Post('requests')
  @ApiOperation({ summary: 'Create async approval request (any staff)' })
  createRequest(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateApprovalRequestDto,
  ) {
    return this.dualControl.createApprovalRequest(
      user.companyId,
      { sub: user.sub, role: user.role, email: user.email },
      dto.action,
      dto.payload || {},
      dto.summary,
    );
  }

  @Get('requests/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'List pending approval requests (ADMIN/MANAGER)' })
  listPending(@CurrentUser() user: TokenPayload) {
    return this.dualControl.listPending(user.companyId);
  }

  @Get('requests/history')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Recent decided approval requests (audit)' })
  listHistory(
    @CurrentUser() user: TokenPayload,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 40;
    return this.dualControl.listHistory(
      user.companyId,
      Number.isFinite(n) ? n : 40,
    );
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get approval request status (requester or manager)' })
  getRequest(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.dualControl.getApprovalRequest(user.companyId, id, {
      sub: user.sub,
      role: user.role,
      email: user.email,
    });
  }

  @Post('requests/:id/decide')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Approve or reject a pending request (ADMIN/MANAGER)' })
  decide(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: DecideApprovalRequestDto,
  ) {
    return this.dualControl.decide(
      user.companyId,
      { sub: user.sub, role: user.role, email: user.email },
      id,
      dto.approve,
      dto.note,
    );
  }
}
