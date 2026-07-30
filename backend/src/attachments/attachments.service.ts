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
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  list(companyId: string, entityType: string, entityId: string) {
    return this.prisma.attachment.findMany({
      where: { companyId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, userId: string, dto: CreateAttachmentDto) {
    this.assertSafeAttachment(dto);
    const stored = await this.storage.putFromDataUrl(
      companyId,
      dto.fileName,
      dto.mimeType,
      dto.storageKey,
    );

    return this.prisma.attachment.create({
      data: {
        companyId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes || 0,
        storageKey: stored.storageKey,
        uploadedById: userId,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const row = await this.prisma.attachment.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Attachment not found');
    await this.prisma.attachment.delete({ where: { id } });
    await this.storage.removeStored(row.storageKey);
    return { message: 'Deleted' };
  }

  private assertSafeAttachment(dto: CreateAttachmentDto) {
    if (dto.storageKey.length > ATTACHMENT_STORAGE_KEY_MAX) {
      throw new BadRequestException('Attachment exceeds maximum size (2 MB)');
    }
    if (dto.sizeBytes != null && dto.sizeBytes > 2_000_000) {
      throw new BadRequestException('Attachment exceeds maximum size (2 MB)');
    }
    const mimeType = dto.mimeType.trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException('Attachment MIME type is not allowed');
    }
  }
}
