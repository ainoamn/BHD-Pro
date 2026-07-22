import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentGatewaySlug } from '@prisma/client';
import { GATEWAY_META } from './gateway.constants';
import {
  decryptConfigSecrets,
  encryptConfigSecrets,
} from '../common/crypto/secrets.crypto';

function secretKeysFor(slug: PaymentGatewaySlug): string[] {
  return (GATEWAY_META[slug]?.configKeys || []).filter((k) => k.secret).map((k) => k.key);
}

@Injectable()
export class CompanyGatewaysService {
  constructor(private prisma: PrismaService) {}

  async ensureDefaults(companyId: string) {
    for (const slug of Object.keys(GATEWAY_META) as PaymentGatewaySlug[]) {
      const meta = GATEWAY_META[slug];
      await this.prisma.companyPaymentGateway.upsert({
        where: { companyId_slug: { companyId, slug } },
        create: {
          companyId,
          slug,
          configJson: Object.fromEntries(meta.configKeys.map((k) => [k.key, ''])),
        },
        update: {},
      });
    }
  }

  async list(companyId: string) {
    await this.ensureDefaults(companyId);
    return this.prisma.companyPaymentGateway.findMany({
      where: { companyId },
      orderBy: { slug: 'asc' },
    });
  }

  async listEnabled(companyId: string) {
    await this.ensureDefaults(companyId);
    return this.prisma.companyPaymentGateway.findMany({
      where: { companyId, isEnabled: true },
    });
  }

  async get(companyId: string, slug: PaymentGatewaySlug) {
    await this.ensureDefaults(companyId);
    const gw = await this.prisma.companyPaymentGateway.findUnique({
      where: { companyId_slug: { companyId, slug } },
    });
    if (!gw) throw new NotFoundException('Gateway not found');
    return gw;
  }

  decryptedConfig(gateway: { slug: PaymentGatewaySlug; configJson: unknown }): Record<string, string> {
    const raw = (gateway.configJson as Record<string, string>) || {};
    return decryptConfigSecrets(raw, secretKeysFor(gateway.slug));
  }

  async update(
    companyId: string,
    slug: PaymentGatewaySlug,
    data: { isEnabled?: boolean; isTestMode?: boolean; configJson?: Record<string, string> },
    userRole: string,
  ) {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Only company admin can configure payment gateways');
    }

    const existing = await this.get(companyId, slug);
    const currentConfig = (existing.configJson as Record<string, string>) || {};
    let nextConfig = currentConfig;
    if (data.configJson) {
      const merged = { ...currentConfig, ...data.configJson };
      nextConfig = encryptConfigSecrets(merged, secretKeysFor(slug));
      for (const key of secretKeysFor(slug)) {
        const incoming = data.configJson[key];
        // Keep existing encrypted secret when UI sends mask or blank (user did not re-enter)
        if (incoming === '••••••••' || incoming === undefined || incoming === '') {
          nextConfig[key] = currentConfig[key] ?? '';
        }
      }
    }

    return this.prisma.companyPaymentGateway.update({
      where: { companyId_slug: { companyId, slug } },
      data: {
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.isTestMode !== undefined && { isTestMode: data.isTestMode }),
        ...(data.configJson && { configJson: nextConfig }),
      },
    });
  }

  toSafe(gateway: {
    slug: PaymentGatewaySlug;
    isEnabled: boolean;
    isTestMode: boolean;
    configJson: unknown;
  }) {
    const config = (gateway.configJson as Record<string, string>) || {};
    const meta = GATEWAY_META[gateway.slug];
    const safeConfig: Record<string, string | boolean> = {};
    for (const key of meta.configKeys) {
      if (key.secret) {
        safeConfig[key.key] = config[key.key] ? '••••••••' : '';
      } else {
        safeConfig[key.key] = config[key.key] ?? '';
      }
    }
    return {
      slug: gateway.slug,
      nameAr: meta.nameAr,
      nameEn: meta.nameEn,
      isEnabled: gateway.isEnabled,
      isTestMode: gateway.isTestMode,
      online: meta.online,
      config: safeConfig,
      configKeys: meta.configKeys,
    };
  }
}
