import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '@prisma/client';

type TaxConfig = {
  applyVat?: boolean;
  pricesIncludeTax?: boolean;
  vatRate?: number;
};

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  private withTaxSettings(company: {
    ftaConfig: Prisma.JsonValue | null;
    [key: string]: unknown;
  }) {
    const tax = (company.ftaConfig as TaxConfig) || {};
    return {
      ...company,
      applyVat: tax.applyVat !== false,
      pricesIncludeTax: !!tax.pricesIncludeTax,
      vatRate: typeof tax.vatRate === 'number' ? tax.vatRate : 5,
    };
  }

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    return this.withTaxSettings(company);
  }

  async updateCompany(companyId: string, dto: UpdateCompanyDto) {
    const existing = await this.getCompany(companyId);
    const {
      applyVat,
      pricesIncludeTax,
      vatRate,
      ...rest
    } = dto;

    const prevTax = (existing.ftaConfig as TaxConfig) || {};
    const ftaConfig: TaxConfig = {
      ...prevTax,
      ...(applyVat !== undefined ? { applyVat } : {}),
      ...(pricesIncludeTax !== undefined ? { pricesIncludeTax } : {}),
      ...(vatRate !== undefined ? { vatRate } : {}),
    };

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...rest,
        ftaConfig: ftaConfig as Prisma.InputJsonValue,
      },
    });

    return this.withTaxSettings(updated);
  }
}
