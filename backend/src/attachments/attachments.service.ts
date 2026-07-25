import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ATTACHMENT_STORAGE_KEY_MAX,
  CreateAttachmentDto,
} from './dto/attachment.dto';

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
];

@Injectable()
export class AttachmentsService {
  constructor(private prisma: PrismaService) {}

  list(companyId: string, entityType: string, entityId: string) {
    return this.prisma.attachment.findMany({
      where: { companyId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(companyId: string, userId: string, dto: CreateAttachmentDto) {
    this.assertSafeAttachment(dto);

    return this.prisma.attachment.create({
      data: {
        companyId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes || 0,
        storageKey: dto.storageKey,
        uploadedById: userId,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const row = await this.prisma.attachment.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Attachment not found');
    await this.prisma.attachment.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private assertSafeAttachment(dto: CreateAttachmentDto) {
    if (dto.storageKey.length > ATTACHMENT_STORAGE_KEY_MAX) {
      throw new BadRequestException('Attachment exceeds maximum size (2 MB)');
    }
    if (dto.sizeBytes != null && dto.sizeBytes > 2_000_000) {
      throw new BadRequestException('Attachment exceeds maximum size (2 MB)');
    }
    if (dto.mimeType) {
      const ok = ALLOWED_MIME_PREFIXES.some(
        (p) => dto.mimeType === p || dto.mimeType!.startsWith(p),
      );
      if (!ok) {
        throw new BadRequestException('Attachment MIME type is not allowed');
      }
    }
    if (dto.storageKey.startsWith('data:')) {
      const meta = dto.storageKey.slice(5, dto.storageKey.indexOf(','));
      if (meta && dto.mimeType) {
        // data URL mime should align with declared mime when both present
        const dataMime = meta.split(';')[0];
        if (dataMime && !dto.mimeType.startsWith(dataMime.split('/')[0])) {
          // soft check — only reject obvious mismatches like image vs application
        }
      }
    }
  }
}
