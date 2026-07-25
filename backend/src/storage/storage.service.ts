import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

export type StoredObject = {
  storageKey: string;
  publicUrl?: string | null;
  driver: 'local' | 's3' | 'dataurl';
};

/**
 * Attachment storage: data-URL (legacy), local disk, or S3-compatible.
 * Env:
 *   ATTACHMENT_STORAGE=dataurl|local|s3  (default dataurl)
 *   ATTACHMENT_LOCAL_DIR=./uploads
 *   S3_BUCKET S3_REGION S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY
 *   S3_ENDPOINT (optional MinIO) S3_PUBLIC_BASE_URL
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  driver(): 'local' | 's3' | 'dataurl' {
    const mode = (process.env.ATTACHMENT_STORAGE || 'dataurl').toLowerCase();
    if (mode === 's3' || mode === 'local' || mode === 'dataurl') return mode;
    return 'dataurl';
  }

  isS3Configured(): boolean {
    return !!(
      process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
    );
  }

  async putFromDataUrl(
    companyId: string,
    fileName: string,
    mimeType: string | undefined,
    dataUrlOrKey: string,
  ): Promise<StoredObject> {
    const driver = this.driver();
    if (driver === 'dataurl' || !dataUrlOrKey.startsWith('data:')) {
      return { storageKey: dataUrlOrKey, driver: 'dataurl' };
    }

    const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrlOrKey);
    if (!match) {
      throw new BadRequestException('Invalid data URL for attachment');
    }
    const mime = mimeType || match[1] || 'application/octet-stream';
    const buf = Buffer.from(match[2], 'base64');
    const safeName = fileName.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120);
    const key = `attachments/${companyId}/${randomUUID()}-${safeName}`;

    if (driver === 'local') {
      const root = process.env.ATTACHMENT_LOCAL_DIR || path.join(process.cwd(), 'uploads');
      const full = path.join(root, key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buf);
      return { storageKey: `local:${key}`, publicUrl: null, driver: 'local' };
    }

    if (driver === 's3') {
      if (!this.isS3Configured()) {
        this.logger.warn('S3 requested but not configured — keeping data URL');
        return { storageKey: dataUrlOrKey, driver: 'dataurl' };
      }
      await this.putS3(key, buf, mime);
      const base = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');
      return {
        storageKey: `s3:${key}`,
        publicUrl: base ? `${base}/${key}` : null,
        driver: 's3',
      };
    }

    return { storageKey: dataUrlOrKey, driver: 'dataurl' };
  }

  private async putS3(key: string, body: Buffer, contentType: string) {
    // Dynamic import so local/dev without the package still boots on dataurl/local
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    let S3Client: any;
    let PutObjectCommand: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@aws-sdk/client-s3');
      S3Client = mod.S3Client;
      PutObjectCommand = mod.PutObjectCommand;
    } catch {
      throw new BadRequestException(
        'Install @aws-sdk/client-s3 and set S3_* env to use S3 storage',
      );
    }

    const client = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    });

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
