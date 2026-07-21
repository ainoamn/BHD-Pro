import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentTemplateDto } from './dto/document-template.dto';
import { DocumentTemplateType } from '@prisma/client';

@Injectable()
export class DocumentTemplatesService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string, type?: DocumentTemplateType) {
    return this.prisma.documentTemplate.findMany({
      where: {
        companyId,
        ...(type ? { type } : {}),
      },
      orderBy: [{ type: 'asc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getDefault(companyId: string, type: DocumentTemplateType) {
    const row = await this.prisma.documentTemplate.findFirst({
      where: { companyId, type, isDefault: true, isActive: true },
    });
    if (row) return row;
    return this.prisma.documentTemplate.findFirst({
      where: { companyId, type, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(companyId: string, dto: DocumentTemplateDto) {
    if (dto.isDefault) {
      await this.prisma.documentTemplate.updateMany({
        where: { companyId, type: dto.type },
        data: { isDefault: false },
      });
    }

    return this.prisma.documentTemplate.create({
      data: {
        companyId,
        type: dto.type,
        name: dto.name.trim(),
        headerText: dto.headerText?.trim() || null,
        footerText: dto.footerText?.trim() || null,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(companyId: string, id: string, dto: Partial<DocumentTemplateDto>) {
    const existing = await this.ensure(companyId, id);
    const type = dto.type ?? existing.type;

    if (dto.isDefault) {
      await this.prisma.documentTemplate.updateMany({
        where: { companyId, type, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.headerText !== undefined && {
          headerText: dto.headerText?.trim() || null,
        }),
        ...(dto.footerText !== undefined && {
          footerText: dto.footerText?.trim() || null,
        }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async setDefault(companyId: string, id: string) {
    const existing = await this.ensure(companyId, id);
    await this.prisma.documentTemplate.updateMany({
      where: { companyId, type: existing.type },
      data: { isDefault: false },
    });
    return this.prisma.documentTemplate.update({
      where: { id },
      data: { isDefault: true, isActive: true },
    });
  }

  async remove(companyId: string, id: string) {
    const row = await this.ensure(companyId, id);
    if (row.isDefault) {
      throw new BadRequestException('Cannot delete the default template — set another default first');
    }
    await this.prisma.documentTemplate.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private async ensure(companyId: string, id: string) {
    const row = await this.prisma.documentTemplate.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('Document template not found');
    return row;
  }
}
