import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private service: ApiKeysService) {}

  private assertNotApiKey(req: { apiKeyAuthenticated?: boolean }) {
    if (req.apiKeyAuthenticated) {
      throw new ForbiddenException('API keys cannot manage API keys');
    }
  }

  @Get()
  @ApiOperation({ summary: 'List company API keys (secrets never returned)' })
  findAll(@CurrentUser() user: TokenPayload, @Req() req: { apiKeyAuthenticated?: boolean }) {
    this.assertNotApiKey(req);
    return this.service.findAll(user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create API key — secret returned once' })
  create(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateApiKeyDto,
    @Req() req: { apiKeyAuthenticated?: boolean },
  ) {
    this.assertNotApiKey(req);
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @Req() req: { apiKeyAuthenticated?: boolean },
  ) {
    this.assertNotApiKey(req);
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke API key' })
  revoke(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Req() req: { apiKeyAuthenticated?: boolean },
  ) {
    this.assertNotApiKey(req);
    return this.service.revoke(user.companyId, id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Req() req: { apiKeyAuthenticated?: boolean },
  ) {
    this.assertNotApiKey(req);
    return this.service.remove(user.companyId, id);
  }
}
