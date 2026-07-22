import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Prisma } from '@prisma/client';

type TaxConfig = {
  applyVat?: boolean;
  pricesIncludeTax?: boolean;
  vatRate?: number;
  signatureMode?: 'ELECTRONIC' | 'MANUAL';
  documentColor?: string;
};

const DEFAULT_DOCUMENT_COLOR = '#059669';

function normalizeDocumentColor(color?: string | null): string {
  if (!color) return DEFAULT_DOCUMENT_COLOR;
  let c = color.trim();
  if (!c.startsWith('#')) c = `#${c}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
    c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(c)) return DEFAULT_DOCUMENT_COLOR;
  return c.toUpperCase();
}

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
      signatureMode: tax.signatureMode === 'ELECTRONIC' ? 'ELECTRONIC' : 'MANUAL',
      documentColor: normalizeDocumentColor(tax.documentColor),
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
      signatureMode,
      documentColor,
      logo,
      ...rest
    } = dto;

    const data: Record<string, unknown> = { ...rest };

    if (logo !== undefined) {
      data.logo = this.normalizeLogo(logo);
    }

    const prevTax = (existing.ftaConfig as TaxConfig) || {};
    const ftaConfig: TaxConfig = {
      ...prevTax,
      ...(applyVat !== undefined ? { applyVat } : {}),
      ...(pricesIncludeTax !== undefined ? { pricesIncludeTax } : {}),
      ...(vatRate !== undefined ? { vatRate } : {}),
      ...(signatureMode !== undefined ? { signatureMode } : {}),
      ...(documentColor !== undefined ? { documentColor: normalizeDocumentColor(documentColor) } : {}),
    };

    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...data,
        ftaConfig: ftaConfig as Prisma.InputJsonValue,
      },
    });

    return this.withTaxSettings(updated);
  }

  private normalizeLogo(logo: string | null | undefined): string | null {
    if (logo == null || logo === '') return null;
    const trimmed = logo.trim();
    if (trimmed.startsWith('data:image/')) {
      if (trimmed.length > 850_000) {
        throw new BadRequestException('Logo file is too large (max 500KB)');
      }
      return trimmed;
    }
    if (/^https?:\/\/.+/i.test(trimmed)) {
      return trimmed;
    }
    throw new BadRequestException('Logo must be a PNG/JPEG image or valid URL');
  }
}
