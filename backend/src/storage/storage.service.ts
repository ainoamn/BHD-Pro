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

function sniffMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (buffer.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/)) return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) return 'application/msword';
  if (buffer.subarray(0, 2).toString('ascii') === 'PK') return 'application/zip';
  if (
    buffer.subarray(4, 8).toString('ascii') === 'ftyp' &&
    ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(
      buffer.subarray(8, 12).toString('ascii'),
    )
  ) return 'image/heic';
  if (!buffer.includes(0)) return 'text/plain';
  return null;
}

function mimeMatches(declared: string, detected: string | null): boolean {
  if (!detected) return false;
  if (declared === detected) return true;
  if (declared === 'text/csv' && detected === 'text/plain') return true;
  if (declared === 'image/heif' && detected === 'image/heic') return true;
  if (
    detected === 'application/zip' &&
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(declared)
  ) {
    return true;
  }
  if (
    detected === 'application/msword' &&
    declared === 'application/vnd.ms-excel'
  ) {
    return true;
  }
  return false;
}

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
    expectedSize?: number,
  ): Promise<StoredObject> {
    const driver = this.driver();
    if (!dataUrlOrKey.startsWith('data:')) {
      throw new BadRequestException('New attachments must be uploaded as a data URL');
    }

    const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrlOrKey);
    if (!match) {
      throw new BadRequestException('Invalid data URL for attachment');
    }
    const headerMime = String(match[1] || '').trim().toLowerCase();
    const mime = String(mimeType || headerMime).trim().toLowerCase();
    if (headerMime !== mime) {
      throw new BadRequestException('Attachment MIME declaration does not match data URL');
    }
    const buf = Buffer.from(match[2], 'base64');
    if (!buf.length || buf.length > 2_000_000) {
      throw new BadRequestException('Attachment exceeds maximum size (2 MB)');
    }
    if (expectedSize != null && expectedSize !== buf.length) {
      throw new BadRequestException('Attachment size does not match decoded content');
    }
    if (!mimeMatches(mime, sniffMime(buf))) {
      throw new BadRequestException('Attachment content does not match declared MIME type');
    }
    if (driver === 'dataurl') {
      return { storageKey: dataUrlOrKey, driver: 'dataurl' };
    }
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
        ContentDisposition: 'attachment',
        ServerSideEncryption: process.env.S3_KMS_KEY_ID ? 'aws:kms' : 'AES256',
        ...(process.env.S3_KMS_KEY_ID
          ? { SSEKMSKeyId: process.env.S3_KMS_KEY_ID }
          : {}),
      }),
    );
  }
}
