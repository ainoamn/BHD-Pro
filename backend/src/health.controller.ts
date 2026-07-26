import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      status: 'ok',
      service: 'bhd-pro-api',
      timestamp: new Date().toISOString(),
      // Render injects this; used to confirm /admin fixes are live
      commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
    };
  }
}
