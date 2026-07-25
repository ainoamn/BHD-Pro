import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { RestoService } from './resto.service';
import { LinkRestoDto } from './dto/resto.dto';

const RESTO_STAFF = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.RESTO_MANAGER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.CASHIER,
  UserRole.ACCOUNTANT,
] as const;

@ApiTags('resto')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resto')
export class RestoController {
  constructor(private readonly resto: RestoService) {}

  @Get('link-status')
  @ApiOperation({ summary: 'Restaurant ↔ company link status' })
  linkStatus(@CurrentUser() user: TokenPayload) {
    return this.resto.getLinkStatus(user.companyId);
  }

  @Post('link/activate')
  @ApiOperation({ summary: 'Activate restaurant link (SSO)' })
  activate(@CurrentUser() user: TokenPayload) {
    return this.resto.activateLink(user.companyId);
  }

  @Post('link/deactivate')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.RESTO_MANAGER)
  @ApiOperation({ summary: 'Deactivate restaurant link' })
  deactivate(@CurrentUser() user: TokenPayload) {
    return this.resto.deactivateLink(user.companyId);
  }

  @Post('link/generate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Generate restaurant integration key' })
  generate(@CurrentUser() user: TokenPayload) {
    return this.resto.generateIntegrationKey(user.companyId);
  }

  @Post('link')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirm restaurant link with key' })
  linkWithKey(@CurrentUser() user: TokenPayload, @Body() dto: LinkRestoDto) {
    return this.resto.linkWithKey(user.companyId, dto.key);
  }

  @Get('menu')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Active products as restaurant menu' })
  menu(@CurrentUser() user: TokenPayload, @Query('q') q?: string) {
    return this.resto.getMenu(user.companyId, q);
  }

  @Get('floor')
  @Roles(...RESTO_STAFF)
  @ApiOperation({ summary: 'Floor layout (empty until R2)' })
  floor(@CurrentUser() user: TokenPayload) {
    return this.resto.getFloor(user.companyId);
  }
}
