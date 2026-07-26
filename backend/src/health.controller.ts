import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check (liveness)' })
  check() {
    return {
      status: 'ok',
      service: 'bhd-pro-api',
      timestamp: new Date().toISOString(),
      // Render injects this; used to confirm /admin fixes are live
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness — database ping' })
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'not_ready',
        database: 'error',
      });
    }
  }
}
