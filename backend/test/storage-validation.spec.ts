import { BadRequestException } from '@nestjs/common';
import { StorageService } from '../src/storage/storage.service';

describe('attachment content validation', () => {
  const service = new StorageService();

  beforeEach(() => {
    process.env.ATTACHMENT_STORAGE = 'dataurl';
  });

  it('accepts a valid PDF signature and verifies decoded size', async () => {
    const bytes = Buffer.from('%PDF-1.7\nminimal');
    await expect(
      service.putFromDataUrl(
        'tenant-1',
        'invoice.pdf',
        'application/pdf',
        `data:application/pdf;base64,${bytes.toString('base64')}`,
        bytes.length,
      ),
    ).resolves.toMatchObject({ driver: 'dataurl' });
  });

  it('rejects executable or spoofed bytes declared as a PDF', async () => {
    const bytes = Buffer.from('MZ\u0000\u0000not-a-pdf');
    await expect(
      service.putFromDataUrl(
        'tenant-1',
        'invoice.pdf',
        'application/pdf',
        `data:application/pdf;base64,${bytes.toString('base64')}`,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
