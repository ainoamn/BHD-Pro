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
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentTemplateDto } from './dto/document-template.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { DocumentTemplateType } from '@prisma/client';

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
  create(@CurrentUser() user: TokenPayload, @Body() dto: DocumentTemplateDto) {
    return this.service.create(user.companyId, dto);
  }

  @Put(':id')
  update(
    @CurrentUser() user: TokenPayload,
    @Param('id') id: string,
    @Body() dto: Partial<DocumentTemplateDto>,
  ) {
    return this.service.update(user.companyId, id, dto);
  }

  @Post(':id/set-default')
  setDefault(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.setDefault(user.companyId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: TokenPayload, @Param('id') id: string) {
    return this.service.remove(user.companyId, id);
  }
}
