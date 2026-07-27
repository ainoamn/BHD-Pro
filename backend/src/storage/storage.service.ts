import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

export type StorageDriver = 'local' | 's3' | 'dataurl';

export type StoredObject = {
  storageKey: string;
  publicUrl?: string | null;
  driver: StorageDriver;
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
  private s3Client: S3Client | null = null;

  driver(): StorageDriver {
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

  /** Status for /health — never throws. */
  status(): { driver: StorageDriver; s3Configured: boolean } {
    return {
      driver: this.driver(),
      s3Configured: this.isS3Configured(),
    };
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
      const root =
        process.env.ATTACHMENT_LOCAL_DIR || path.join(process.cwd(), 'uploads');
      const full = path.join(root, key);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buf);
      return { storageKey: `local:${key}`, publicUrl: null, driver: 'local' };
    }

    if (driver === 's3') {
      if (!this.isS3Configured()) {
        throw new ServiceUnavailableException(
          'ATTACHMENT_STORAGE=s3 but S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not set',
        );
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

  /** Best-effort delete of local/S3 objects. Data URLs are no-ops. */
  async removeStored(storageKey: string): Promise<void> {
    if (!storageKey) return;

    if (storageKey.startsWith('local:')) {
      const rel = storageKey.slice('local:'.length);
      const root =
        process.env.ATTACHMENT_LOCAL_DIR || path.join(process.cwd(), 'uploads');
      const full = path.join(root, rel);
      try {
        await fs.unlink(full);
      } catch (err) {
        this.logger.warn(
          `Local attachment delete skipped: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return;
    }

    if (storageKey.startsWith('s3:')) {
      if (!this.isS3Configured()) {
        this.logger.warn('S3 attachment delete skipped — S3 not configured');
        return;
      }
      const key = storageKey.slice('s3:'.length);
      try {
        await this.getS3().send(
          new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: key,
          }),
        );
      } catch (err) {
        this.logger.warn(
          `S3 attachment delete failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private getS3(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: process.env.S3_REGION || 'us-east-1',
        endpoint: process.env.S3_ENDPOINT || undefined,
        forcePathStyle: !!process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
      });
    }
    return this.s3Client;
  }

  private async putS3(key: string, body: Buffer, contentType: string) {
    await this.getS3().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}
