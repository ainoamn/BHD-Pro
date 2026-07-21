import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ErpService } from './erp.service';
import { AssetDto } from './dto/erp.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Fixed Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assets')
export class AssetsController {
  constructor(private erp: ErpService) {}

  @Get() findAll(@CurrentUser() u: TokenPayload) {
    return this.erp.findAssets(u.companyId);
  }
  @Post() create(@CurrentUser() u: TokenPayload, @Body() dto: AssetDto) {
    return this.erp.createAsset(u.companyId, dto);
  }
  @Put(':id') update(@CurrentUser() u: TokenPayload, @Param('id') id: string, @Body() dto: Partial<AssetDto>) {
    return this.erp.updateAsset(u.companyId, id, dto);
  }
  @Delete(':id') remove(@CurrentUser() u: TokenPayload, @Param('id') id: string) {
    return this.erp.deleteAsset(u.companyId, id);
  }
}
