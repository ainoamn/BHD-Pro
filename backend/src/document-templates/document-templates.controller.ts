import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { DocumentTemplateType, UserRole } from '@prisma/client';
import { DocumentTemplatesService } from './document-templates.service';
import {
  DocumentTemplateDto,
  UpdateDocumentTemplateDto,
} from './dto/document-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

@ApiTags('Document Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('document-templates')
export class DocumentTemplatesController {
  constructor(private service: DocumentTemplatesService) {}

  @Get()
  @ApiQuery({ name: 'type', required: false, enum: DocumentTemplateType })
  findAll(
    @CurrentUser() user: TokenPayload,
    @Query('type') type?: DocumentTemplateType,
  ) {
    return this.service.findAll(user.companyId, type);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default (or first active) template for a document type' })
  @ApiQuery({ name: 'type', required: true, enum: DocumentTemplateType })
  getDefault(
    @CurrentUser() user: TokenPayload,
    @Query('type') type: DocumentTemplateType,
  ) {
    return this.service.getDefault(user.companyId, type);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  create(@CurrentUser() user: TokenPayload, @Body() dto: DocumentTemplateDto) {
    return this.service.create(user.companyId, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTemplateDto,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/set-default')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  setDefault(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.setDefault(user.companyId, id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
