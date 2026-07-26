import { Controller, Get, Put, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateSecurityConfigDto } from '../dual-control/dto/approval.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(
    private companiesService: CompaniesService,
    private dualControl: DualControlService,
  ) {}

  @Get('me')
  getMyCompany(@CurrentUser() user: TokenPayload) {
    return this.companiesService.getCompany(user.companyId);
  }

  @Put('me')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  updateMyCompany(@CurrentUser() user: TokenPayload, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.updateCompany(user.companyId, dto);
  }

  @Get('me/security')
  @ApiOperation({ summary: 'Public dual-control security flags (no secrets)' })
  getSecurity(@CurrentUser() user: TokenPayload) {
    return this.dualControl.getPublicConfig(user.companyId);
  }

  @Patch('me/security')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update dual-control settings (ADMIN)' })
  updateSecurity(
    @CurrentUser() user: TokenPayload,
    @Body() dto: UpdateSecurityConfigDto,
  ) {
    return this.dualControl.updateSettings(user.companyId, dto, user.sub);
  }
}
