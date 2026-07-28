describe('Redis optional wiring', () => {
  const original = process.env.REDIS_URL;
  const originalTtl = process.env.POS_CATALOG_CACHE_TTL_SEC;

  afterEach(() => {
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
    if (originalTtl === undefined) delete process.env.POS_CATALOG_CACHE_TTL_SEC;
    else process.env.POS_CATALOG_CACHE_TTL_SEC = originalTtl;
    jest.resetModules();
  });

  it('reports not configured when REDIS_URL is empty', async () => {
    process.env.REDIS_URL = '';
    const { RedisService } = await import('../src/redis/redis.service');
    const svc = new RedisService();
    expect(svc.isConfigured()).toBe(false);
    expect(await svc.ping()).toBe('skipped');
    expect(await svc.invalidatePosCatalog('co1')).toBe(0);
    await svc.onModuleDestroy();
  });

  it('builds catalog keys and clamps TTL', async () => {
    process.env.REDIS_URL = '';
    process.env.POS_CATALOG_CACHE_TTL_SEC = '9999';
    const { RedisService } = await import('../src/redis/redis.service');
    const svc = new RedisService();
    expect(svc.posCatalogKey('co1', null)).toBe('hisaby:pos:catalog:v1:co1:all');
    expect(svc.posCatalogKey('co1', 'wh9')).toBe('hisaby:pos:catalog:v1:co1:wh9');
    expect(svc.posCatalogTtlSec()).toBe(600);
    await svc.onModuleDestroy();
  });
});
