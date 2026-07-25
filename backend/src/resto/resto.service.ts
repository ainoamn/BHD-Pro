import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RestoService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  async getLinkStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        restoLinkedAt: true,
        restoIntegrationKeyPrefix: true,
        posLinkedAt: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      linked: !!company.restoLinkedAt,
      companyId: company.id,
      companyName: company.name,
      keyPrefix: company.restoIntegrationKeyPrefix,
      posLinked: !!company.posLinkedAt,
      apps: { accounting: true, pos: true, resto: true },
    };
  }

  /** Same-login SSO: mark Accounting/POS ↔ Restaurants as linked */
  async activateLink(companyId: string) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: { restoLinkedAt: new Date() },
      select: { id: true, name: true, restoLinkedAt: true },
    });
    return {
      linked: true,
      companyId: company.id,
      companyName: company.name,
      linkedAt: company.restoLinkedAt,
    };
  }

  async deactivateLink(companyId: string) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        restoLinkedAt: null,
        restoIntegrationKeyHash: null,
        restoIntegrationKeyPrefix: null,
      },
      select: { id: true, name: true, restoLinkedAt: true },
    });
    return {
      linked: false,
      companyId: company.id,
      companyName: company.name,
      linkedAt: null,
    };
  }

  async generateIntegrationKey(companyId: string) {
    const secret = `hresto_${randomBytes(24).toString('hex')}`;
    const prefix = secret.slice(0, 12);
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        restoIntegrationKeyHash: this.hashKey(secret),
        restoIntegrationKeyPrefix: prefix,
        restoLinkedAt: new Date(),
      },
    });
    return {
      key: secret,
      prefix,
      linked: true,
      warning: 'Store this key now — it will not be shown again',
    };
  }

  async linkWithKey(companyId: string, key: string) {
    const trimmed = key.trim();
    if (!trimmed.startsWith('hresto_')) {
      throw new BadRequestException('Invalid restaurant integration key');
    }
    const hash = this.hashKey(trimmed);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, restoIntegrationKeyHash: hash },
      select: { id: true },
    });
    if (!company) {
      throw new BadRequestException(
        'Integration key does not match this company — generate a key while signed into the same company, or use shared login to link',
      );
    }
    return this.activateLink(companyId);
  }

  /** Active products as restaurant menu (R1 — no separate menu catalog yet) */
  async getMenu(companyId: string, q?: string) {
    const query = q?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { nameEn: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } },
                { barcode: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        nameEn: true,
        sku: true,
        barcode: true,
        salePrice: true,
        unit: true,
        category: true,
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return {
      items: products.map((p) => ({
        id: p.id,
        name: p.name,
        nameEn: p.nameEn,
        sku: p.sku,
        barcode: p.barcode,
        price: p.salePrice,
        unit: p.unit,
        category: p.category,
      })),
      count: products.length,
    };
  }

  /** Empty floor placeholder until R2 tables */
  async getFloor(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, restoLinkedAt: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      companyId: company.id,
      companyName: company.name,
      linked: !!company.restoLinkedAt,
      zones: [] as Array<{ id: string; name: string; tables: unknown[] }>,
      tables: [] as Array<{
        id: string;
        name: string;
        seats: number;
        status: string;
      }>,
      message: 'Floor layout arrives in wave R2',
    };
  }
}
