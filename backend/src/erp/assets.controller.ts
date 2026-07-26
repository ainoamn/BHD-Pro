import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiPropertyOptional } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ErpService } from './erp.service';
import { AssetDto, UpdateAssetDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DualControlService } from '../dual-control/dual-control.service';
import { DualApprovalDto } from '../dual-control/dto/approval.dto';

class AssetDepreciationDto {
  @ApiPropertyOptional({ type: DualApprovalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DualApprovalDto)
  approval?: DualApprovalDto;
}

@ApiTags('Fixed Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(
    private erp: ErpService,
    private dualControl: DualControlService,
  ) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findAssets(u.companyId);
  }
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@CurrentUser() u: TokenPayload, @Body() dto: AssetDto) {
    return this.erp.createAsset(u.companyId, dto);
  }
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  update(@CurrentUser() u: TokenPayload, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.erp.updateAsset(u.companyId, id, dto);
  }
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deleteAsset(u.companyId, id);
  }

  @Post(':id/depreciate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async depreciate(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AssetDepreciationDto,
  ) {
    await this.dualControl.assertApproved(
      u.companyId,
      u,
      'ASSET_DEPRECIATE',
      dto?.approval,
    );
    return this.erp.depreciateAsset(u.companyId, u.sub, id);
  }

  @Post(':id/reverse-last-depreciation')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ACCOUNTANT)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async reverseLastDepreciation(
    @CurrentUser() u: TokenPayload,
    @Param('id') id: string,
    @Body() dto: AssetDepreciationDto,
  ) {
    await this.dualControl.assertApproved(
      u.companyId,
      u,
      'ASSET_DEPRECIATE',
      dto?.approval,
    );
    return this.erp.reverseLastDepreciation(u.companyId, u.sub, id);
  }
}
