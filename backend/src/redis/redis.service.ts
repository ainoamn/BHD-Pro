import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis | null;

  constructor() {
    const url = (process.env.REDIS_URL || '').trim();
    if (!url) {
      this.client = null;
      return;
    }
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  getClient(): Redis | null {
    return this.client;
  }

  /** Ping Redis when configured. `skipped` means REDIS_URL unset. */
  async ping(): Promise<'ok' | 'skipped' | 'error'> {
    if (!this.client) return 'skipped';
    try {
      if (this.client.status !== 'ready') {
        await this.client.connect();
      }
      const reply = await this.client.ping();
      return reply === 'PONG' ? 'ok' : 'error';
    } catch (err) {
      this.logger.warn(
        `Redis ping failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'error';
    }
  }

  async onModuleDestroy() {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }
}
