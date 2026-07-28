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
      if (!(await this.ensureReady())) return 'error';
      const reply = await this.client.ping();
      return reply === 'PONG' ? 'ok' : 'error';
    } catch (err) {
      this.logger.warn(
        `Redis ping failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return 'error';
    }
  }

  posCatalogKey(companyId: string, warehouseId?: string | null): string {
    return `hisaby:pos:catalog:v1:${companyId}:${warehouseId || 'all'}`;
  }

  /** TTL seconds for POS full catalog cache (default 60, clamp 5–600). */
  posCatalogTtlSec(): number {
    const n = Number(process.env.POS_CATALOG_CACHE_TTL_SEC || 60);
    if (!Number.isFinite(n)) return 60;
    return Math.min(600, Math.max(5, Math.floor(n)));
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!(await this.ensureReady()) || !this.client) return null;
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(
        `Redis getJson failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec: number): Promise<void> {
    if (!(await this.ensureReady()) || !this.client) return;
    try {
      const payload = JSON.stringify(value);
      if (ttlSec > 0) {
        await this.client.set(key, payload, 'EX', ttlSec);
      } else {
        await this.client.set(key, payload);
      }
    } catch (err) {
      this.logger.warn(
        `Redis setJson failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Drop all POS catalog cache keys for a company (product/stock writes). */
  async invalidatePosCatalog(companyId: string): Promise<number> {
    if (!(await this.ensureReady()) || !this.client) return 0;
    const pattern = `hisaby:pos:catalog:v1:${companyId}:*`;
    let removed = 0;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          64,
        );
        cursor = next;
        if (keys.length) {
          removed += await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      this.logger.warn(
        `Redis invalidatePosCatalog failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return removed;
  }

  private async ensureReady(): Promise<boolean> {
    if (!this.client) return false;
    try {
      if (this.client.status !== 'ready') {
        await this.client.connect();
      }
      return true;
    } catch (err) {
      this.logger.warn(
        `Redis connect failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
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
