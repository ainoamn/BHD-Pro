import { StorageService } from '../src/storage/storage.service';

describe('StorageService', () => {
  const envKeys = [
    'ATTACHMENT_STORAGE',
    'S3_BUCKET',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
  ] as const;
  const backup: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) backup[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (backup[k] === undefined) delete process.env[k];
      else process.env[k] = backup[k];
    }
  });

  it('defaults to dataurl driver', () => {
    delete process.env.ATTACHMENT_STORAGE;
    const svc = new StorageService();
    expect(svc.driver()).toBe('dataurl');
    expect(svc.status().driver).toBe('dataurl');
  });

  it('reports s3Configured only when all keys set', () => {
    process.env.ATTACHMENT_STORAGE = 's3';
    process.env.S3_BUCKET = 'bucket';
    process.env.S3_ACCESS_KEY_ID = 'key';
    process.env.S3_SECRET_ACCESS_KEY = 'secret';
    const svc = new StorageService();
    expect(svc.isS3Configured()).toBe(true);
    expect(svc.status()).toEqual({ driver: 's3', s3Configured: true });
  });

  it('rejects s3 put when misconfigured', async () => {
    process.env.ATTACHMENT_STORAGE = 's3';
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    const svc = new StorageService();
    await expect(
      svc.putFromDataUrl(
        'co1',
        'a.pdf',
        'application/pdf',
        'data:application/pdf;base64,AAAA',
      ),
    ).rejects.toThrow(/S3_BUCKET/);
  });
});
