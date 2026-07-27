describe('Redis optional wiring', () => {
  const original = process.env.REDIS_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = original;
    jest.resetModules();
  });

  it('reports not configured when REDIS_URL is empty', async () => {
    process.env.REDIS_URL = '';
    const { RedisService } = await import('../src/redis/redis.service');
    const svc = new RedisService();
    expect(svc.isConfigured()).toBe(false);
    expect(await svc.ping()).toBe('skipped');
    await svc.onModuleDestroy();
  });
});
