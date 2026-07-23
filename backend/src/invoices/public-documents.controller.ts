import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DocumentShareService, DocumentShareVariant } from './document-share.service';

@ApiTags('Public Documents')
@Controller('public/documents')
export class PublicDocumentsController {
  constructor(private documentShare: DocumentShareService) {}

  @Get('c/:code')
  @ApiOperation({ summary: 'View document by short public verify code' })
  getByCode(
    @Param('code') code: string,
    @Query('variant') variant?: DocumentShareVariant,
  ) {
    return this.documentShare.resolveByPublicCode(code, variant || 'invoice');
  }

  @Get(':token')
  @ApiOperation({ summary: 'View shared document (public JWT link)' })
  getSharedDocument(@Param('token') token: string) {
    return this.documentShare.resolvePublicDocument(token);
  }
}
