import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@ApiTags('Health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check (liveness)' })
  check() {
    return {
      status: 'ok',
      service: 'bhd-pro-api',
      timestamp: new Date().toISOString(),
      // Render injects this; used to confirm /admin fixes are live
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
      sentry: !!(process.env.SENTRY_DSN || '').trim(),
      redisConfigured: this.redis.isConfigured(),
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

    return {
      status: 'ready',
      database: 'ok',
      redis,
      sentry: !!(process.env.SENTRY_DSN || '').trim(),
      redisConfigured: this.redis.isConfigured(),
      timestamp: new Date().toISOString(),
    };
  }
}
