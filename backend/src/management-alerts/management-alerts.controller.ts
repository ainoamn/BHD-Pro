import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ManagementAlertsService } from './management-alerts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

class ResolveAlertDto {
  @ApiPropertyOptional({ example: 'RESOLVED' })
  @IsOptional()
  @IsString()
  status?: string;
}

@ApiTags('Management Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('management-alerts')
export class ManagementAlertsController {
  constructor(private service: ManagementAlertsService) {}

  @Get()
  list(
    @CurrentUser() user: TokenPayload,
    @Query('status') status?: string,
  ) {
    return this.service.list(user.companyId, user.role, status);
  }

  @Patch(':id')
  resolve(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: ResolveAlertDto,
  ) {
    return this.service.resolve(user.companyId, user.role, user.sub, id, dto.status || 'RESOLVED');
  }
}
