import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomFieldDefinitionDto } from './dto/custom-field.dto';
import { CustomFieldEntity, CustomFieldType, Prisma } from '@prisma/client';

@Injectable()
export class CustomFieldsService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string, entityType?: CustomFieldEntity) {
    return this.prisma.customFieldDefinition.findMany({
      where: {
        companyId,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  async create(companyId: string, dto: CustomFieldDefinitionDto) {
    this.validateOptions(dto.fieldType, dto.options);
    const key = dto.key.trim().toLowerCase();
    const dup = await this.prisma.customFieldDefinition.findFirst({
      where: { companyId, entityType: dto.entityType, key },
    });
    if (dup) throw new ConflictException('Field key already exists for this entity');

    return this.prisma.customFieldDefinition.create({
      data: {
        companyId,
        entityType: dto.entityType,
        key,
        label: dto.label.trim(),
        labelEn: dto.labelEn?.trim() || null,
        fieldType: dto.fieldType,
        optionsJson: this.toOptionsJson(dto.fieldType, dto.options),
        sortOrder: dto.sortOrder ?? 0,
        isRequired: dto.isRequired ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(companyId: string, id: string, dto: Partial<CustomFieldDefinitionDto>) {
    const existing = await this.ensure(companyId, id);
    const fieldType = dto.fieldType ?? existing.fieldType;
    if (dto.options !== undefined || dto.fieldType) {
      this.validateOptions(fieldType, dto.options);
    }

    if (dto.key && dto.key.trim().toLowerCase() !== existing.key) {
      const key = dto.key.trim().toLowerCase();
      const entityType = dto.entityType ?? existing.entityType;
      const dup = await this.prisma.customFieldDefinition.findFirst({
        where: { companyId, entityType, key, NOT: { id } },
      });
      if (dup) throw new ConflictException('Field key already exists for this entity');
    }

    return this.prisma.customFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.entityType !== undefined && { entityType: dto.entityType }),
        ...(dto.key !== undefined && { key: dto.key.trim().toLowerCase() }),
        ...(dto.label !== undefined && { label: dto.label.trim() }),
        ...(dto.labelEn !== undefined && { labelEn: dto.labelEn?.trim() || null }),
        ...(dto.fieldType !== undefined && { fieldType: dto.fieldType }),
        ...(dto.options !== undefined && {
          optionsJson: this.toOptionsJson(fieldType, dto.options),
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.ensure(companyId, id);
    await this.prisma.customFieldDefinition.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private async ensure(companyId: string, id: string) {
    const row = await this.prisma.customFieldDefinition.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('Custom field not found');
    return row;
  }

  private validateOptions(fieldType: CustomFieldType, options?: string[]) {
    if (fieldType === CustomFieldType.SELECT) {
      const cleaned = (options || []).map((o) => o.trim()).filter(Boolean);
      if (cleaned.length === 0) {
        throw new BadRequestException('SELECT fields require at least one option');
      }
    }
  }

  private toOptionsJson(
    fieldType: CustomFieldType,
    options?: string[],
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (fieldType !== CustomFieldType.SELECT) return Prisma.JsonNull;
    return (options || []).map((o) => o.trim()).filter(Boolean);
  }
}
