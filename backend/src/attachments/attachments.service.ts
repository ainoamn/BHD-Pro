import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAttachmentDto } from './dto/attachment.dto';

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
}
