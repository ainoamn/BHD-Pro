import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';
import { StorageService } from './storage/storage.service';
import { EmailNotifyService } from './notifications/email-notify.service';
import { WhatsappNotifyService } from './notifications/whatsapp-notify.service';
import { SmsNotifyService } from './notifications/sms-notify.service';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private storage: StorageService,
    private email: EmailNotifyService,
    private whatsapp: WhatsappNotifyService,
    private sms: SmsNotifyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check (liveness)' })
  check() {
    const storage = this.storage.status();
    return {
      status: 'ok',
      service: 'bhd-pro-api',
      timestamp: new Date().toISOString(),
      // Render injects this; used to confirm /admin fixes are live
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
      sentry: !!(process.env.SENTRY_DSN || '').trim(),
      redisConfigured: this.redis.isConfigured(),
      attachmentStorage: storage.driver,
      s3Configured: storage.s3Configured,
      emailConfigured: this.email.isConfigured(),
      emailMode: this.email.mode(),
      whatsappConfigured: this.whatsapp.isConfigured(),
      whatsappMode: this.whatsapp.mode(),
      whatsappReceiptTemplate: this.whatsapp.receiptTemplateName(),
      smsConfigured: this.sms.isConfigured(),
      smsMode: this.sms.mode(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness — database (+ Redis when configured)' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'error',
      });
    }

    const redis = await this.redis.ping();
    if (redis === 'error') {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'ok',
        redis: 'error',
      });
    }

    const storage = this.storage.status();
    if (storage.driver === 's3' && !storage.s3Configured) {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'ok',
        redis,
        attachmentStorage: 's3_misconfigured',
      });
    }

    return {
      status: 'ready',
      database: 'ok',
      redis,
      sentry: !!(process.env.SENTRY_DSN || '').trim(),
      redisConfigured: this.redis.isConfigured(),
      attachmentStorage: storage.driver,
      s3Configured: storage.s3Configured,
      emailConfigured: this.email.isConfigured(),
      emailMode: this.email.mode(),
      whatsappConfigured: this.whatsapp.isConfigured(),
      whatsappMode: this.whatsapp.mode(),
      whatsappReceiptTemplate: this.whatsapp.receiptTemplateName(),
      smsConfigured: this.sms.isConfigured(),
      smsMode: this.sms.mode(),
      timestamp: new Date().toISOString(),
    };
  }
}
