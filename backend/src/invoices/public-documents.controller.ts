import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { DocumentShareService, DocumentShareVariant } from './document-share.service';
import { renderPublicDocumentHtml } from './public-document-html';

@ApiTags('Public Documents')
@Controller('public/documents')
export class PublicDocumentsController {
  constructor(private documentShare: DocumentShareService) {}

  @Get('c/:code/view')
  @ApiOperation({
    summary: 'HTML invoice page for QR scan — shows document and opens print/save',
  })
  @Header('Cache-Control', 'no-store')
  async viewByCode(
    @Param('code') code: string,
    @Query('variant') variant: DocumentShareVariant | undefined,
    @Res() res: Response,
  ) {
    const doc = await this.documentShare.resolveByPublicCode(
      code,
      variant || 'invoice',
    );
    const html = renderPublicDocumentHtml(doc as Parameters<typeof renderPublicDocumentHtml>[0]);
    res.type('html').send(html);
  }

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
