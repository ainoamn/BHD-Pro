import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TaxRateDto } from './dto/tax-rate.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TaxRatesService {
  constructor(private prisma: PrismaService) {}

  async ensureDefaults(companyId: string) {
    const count = await this.prisma.taxRate.count({ where: { companyId } });
    if (count > 0) return;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ftaConfig: true },
    });
    const tax = (company?.ftaConfig as { vatRate?: number }) || {};
    const rate = typeof tax.vatRate === 'number' ? tax.vatRate : 5;

    await this.prisma.taxRate.create({
      data: {
        companyId,
        code: 'VAT',
        name: 'ضريبة القيمة المضافة',
        nameEn: 'VAT',
        rate,
        isDefault: true,
        isActive: true,
      },
    });
  }

  async findAll(companyId: string) {
    await this.ensureDefaults(companyId);
    return this.prisma.taxRate.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
    });
  }

  async create(companyId: string, dto: TaxRateDto) {
    await this.ensureDefaults(companyId);
    const dup = await this.prisma.taxRate.findFirst({
      where: { companyId, code: dto.code.trim() },
    });
    if (dup) throw new ConflictException('Tax rate code exists');

    if (dto.isDefault) {
      await this.prisma.taxRate.updateMany({
        where: { companyId },
        data: { isDefault: false },
      });
    }

    const row = await this.prisma.taxRate.create({
      data: {
        companyId,
        code: dto.code.trim(),
        name: dto.name.trim(),
        nameEn: dto.nameEn?.trim() || null,
        rate: dto.rate,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });

    if (row.isDefault) await this.syncCompanyDefault(companyId, Number(row.rate));
    return row;
  }

  async update(companyId: string, id: string, dto: Partial<TaxRateDto>) {
    const existing = await this.ensure(companyId, id);

    if (dto.code && dto.code.trim() !== existing.code) {
      const dup = await this.prisma.taxRate.findFirst({
        where: { companyId, code: dto.code.trim(), NOT: { id } },
      });
      if (dup) throw new ConflictException('Tax rate code exists');
    }

    if (dto.isDefault) {
      await this.prisma.taxRate.updateMany({
        where: { companyId, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const row = await this.prisma.taxRate.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code.trim() }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn?.trim() || null }),
        ...(dto.rate !== undefined && { rate: dto.rate }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    if (row.isDefault) await this.syncCompanyDefault(companyId, Number(row.rate));
    return row;
  }

  async setDefault(companyId: string, id: string) {
    await this.ensure(companyId, id);
    await this.prisma.taxRate.updateMany({
      where: { companyId },
      data: { isDefault: false },
    });
    const row = await this.prisma.taxRate.update({
      where: { id },
      data: { isDefault: true, isActive: true },
    });
    await this.syncCompanyDefault(companyId, Number(row.rate));
    return row;
  }

  async remove(companyId: string, id: string) {
    const row = await this.ensure(companyId, id);
    if (row.isDefault) {
      throw new BadRequestException('Cannot delete the default tax rate');
    }
    await this.prisma.taxRate.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private async ensure(companyId: string, id: string) {
    const row = await this.prisma.taxRate.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Tax rate not found');
    return row;
  }

  private async syncCompanyDefault(companyId: string, rate: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ftaConfig: true },
    });
    const prev = (company?.ftaConfig as Record<string, unknown>) || {};
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ftaConfig: { ...prev, vatRate: rate } as Prisma.InputJsonValue,
      },
    });
  }
}
