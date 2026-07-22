import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DocumentShareService } from './document-share.service';

@ApiTags('Public Documents')
@Controller('public/documents')
export class PublicDocumentsController {
  constructor(private documentShare: DocumentShareService) {}

  @Get(':token')
  @ApiOperation({ summary: 'View shared document (public link)' })
  getSharedDocument(@Param('token') token: string) {
    return this.documentShare.resolvePublicDocument(token);
  }
}
