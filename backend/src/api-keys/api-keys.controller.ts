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
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private service: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List company API keys (secrets never returned)' })
  findAll(@CurrentUser() user: TokenPayload) {
    return this.service.findAll(user.companyId);
  }

  @Post()
  @ApiOperation({ summary: 'Create API key — secret returned once' })
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateApiKeyDto) {
    return this.service.create(user.companyId, user.sub, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/revoke')
  @ApiOperation({ summary: 'Revoke API key' })
  revoke(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.revoke(user.companyId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
