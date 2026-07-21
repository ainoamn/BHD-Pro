import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GATEWAY_META } from './gateway.constants';

@Injectable()
export class PlatformGatewaysService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    for (const [slug, meta] of Object.entries(GATEWAY_META)) {
      await this.prisma.platformPaymentGateway.upsert({
        where: { slug: slug as keyof typeof GATEWAY_META },
        create: {
          slug: slug as keyof typeof GATEWAY_META,
          nameAr: meta.nameAr,
          nameEn: meta.nameEn,
          sortOrder: meta.sortOrder,
          configJson: Object.fromEntries(meta.configKeys.map((k) => [k.key, ''])),
        },
        update: {
          nameAr: meta.nameAr,
          nameEn: meta.nameEn,
          sortOrder: meta.sortOrder,
        },
      });
    }

    await this.seedFromEnv();
  }

  private async seedFromEnv() {
    const envMap: Partial<Record<string, Record<string, string>>> = {
      STRIPE: {
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      },
      THAWANI: {
        publishableKey: process.env.THAWANI_PUBLISHABLE_KEY || '',
        secretKey: process.env.THAWANI_SECRET_KEY || '',
        webhookSecret: process.env.THAWANI_WEBHOOK_SECRET || '',
        baseUrl: process.env.THAWANI_BASE_URL || 'https://uatcheckout.thawani.om/api/v1',
      },
      PAYPAL: {
        clientId: process.env.PAYPAL_CLIENT_ID || '',
        clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
        webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
      },
    };

    for (const [slug, config] of Object.entries(envMap)) {
      const hasSecret = Object.values(config).some((v) => v && !v.includes('...'));
      if (!hasSecret) continue;
      const existing = await this.prisma.platformPaymentGateway.findUnique({
        where: { slug: slug as never },
      });
      if (!existing) continue;
      await this.prisma.platformPaymentGateway.update({
        where: { slug: slug as never },
        data: {
          isEnabled: true,
          configJson: { ...(existing.configJson as object), ...config },
        },
      });
    }
  }

  listAll() {
    return this.prisma.platformPaymentGateway.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  listEnabled() {
    return this.prisma.platformPaymentGateway.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getBySlug(slug: string) {
    return this.prisma.platformPaymentGateway.findUniqueOrThrow({
      where: { slug: slug as never },
    });
  }

  async update(
    slug: string,
    data: { isEnabled?: boolean; isTestMode?: boolean; configJson?: Record<string, string> },
  ) {
    const existing = await this.getBySlug(slug);
    const currentConfig = (existing.configJson as Record<string, string>) || {};
    return this.prisma.platformPaymentGateway.update({
      where: { slug: slug as never },
      data: {
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.isTestMode !== undefined && { isTestMode: data.isTestMode }),
        ...(data.configJson && { configJson: { ...currentConfig, ...data.configJson } }),
      },
    });
  }

  toPublic(gateway: { slug: string; nameAr: string; nameEn: string; isTestMode: boolean; configJson: unknown }) {
    const config = (gateway.configJson as Record<string, string>) || {};
    const meta = GATEWAY_META[gateway.slug as keyof typeof GATEWAY_META];
    const publicConfig: Record<string, string> = {};
    for (const key of meta?.configKeys ?? []) {
      if (!key.secret && config[key.key]) publicConfig[key.key] = config[key.key];
    }
    return {
      slug: gateway.slug,
      nameAr: gateway.nameAr,
      nameEn: gateway.nameEn,
      isTestMode: gateway.isTestMode,
      publicConfig,
    };
  }
}
