import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type DocumentShareVariant = 'invoice' | 'receipt';

interface DocumentSharePayload {
  purpose: 'doc_share' | 'doc_verify';
  invoiceId: string;
  companyId: string;
  variant: DocumentShareVariant;
}

@Injectable()
export class DocumentShareService {
  private readonly shareTtl = '30d';
  /** Long-lived link for printed QR authenticity checks */
  private readonly verifyTtl = '3650d';

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private frontendBaseUrl(): string {
    const raw =
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      this.config.get<string>('cors.origin') ||
      'http://localhost:3000';
    // CORS_ORIGIN may be comma-separated; use the first public site URL
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  private generateShortCode(length = 10): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = randomBytes(length);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  }

  private async ensurePublicVerifyCode(invoiceId: string): Promise<string> {
    const existing = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { publicVerifyCode: true },
    });
    if (existing?.publicVerifyCode) return existing.publicVerifyCode;

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateShortCode(10);
      try {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { publicVerifyCode: code },
        });
        return code;
      } catch {
        // unique collision — retry
      }
    }
    throw new Error('Could not allocate public verify code');
  }

  private signatureModeFromCompany(ftaConfig: unknown): 'ELECTRONIC' | 'MANUAL' {
    const cfg = (ftaConfig as { signatureMode?: string } | null) || {};
    return cfg.signatureMode === 'ELECTRONIC' ? 'ELECTRONIC' : 'MANUAL';
  }

  private documentColorFromCompany(ftaConfig: unknown): string {
    const cfg = (ftaConfig as { documentColor?: string } | null) || {};
    let c = (cfg.documentColor || '#059669').trim();
    if (!c.startsWith('#')) c = `#${c}`;
    if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
      c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(c)) return '#059669';
    return c.toUpperCase();
  }

  async createShareLink(
    companyId: string,
    invoiceId: string,
    variant: DocumentShareVariant = 'invoice',
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true, number: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const token = await this.jwt.signAsync(
      {
        purpose: 'doc_share',
        invoiceId,
        companyId,
        variant,
      } satisfies DocumentSharePayload,
      {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.shareTtl,
      },
    );

    return {
      token,
      shareUrl: `${this.frontendBaseUrl()}/share/${token}`,
      sharePath: `/share/${token}`,
      expiresInDays: 30,
      documentNumber: invoice.number,
    };
  }

  async createVerifyLink(
    companyId: string,
    invoiceId: string,
    variant: DocumentShareVariant = 'invoice',
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: { id: true, number: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const code = await this.ensurePublicVerifyCode(invoiceId);
    const verifyPath = `/v/${code}`;

    // Keep JWT link as fallback for older clients
    const token = await this.jwt.signAsync(
      {
        purpose: 'doc_verify',
        invoiceId,
        companyId,
        variant,
      } satisfies DocumentSharePayload,
      {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.verifyTtl,
      },
    );

    return {
      token,
      code,
      verifyUrl: `${this.frontendBaseUrl()}${verifyPath}`,
      verifyPath,
      legacyVerifyUrl: `${this.frontendBaseUrl()}/share/${token}`,
      documentNumber: invoice.number,
      variant,
    };
  }

  async resolvePublicDocument(token: string) {
    // Short code path: /public/documents/c/XXXX
    if (token.length <= 16 && !token.includes('.')) {
      return this.resolveByPublicCode(token, 'invoice');
    }

    let payload: DocumentSharePayload;
    try {
      payload = await this.jwt.verifyAsync<DocumentSharePayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired share link');
    }

    if (
      (payload.purpose !== 'doc_share' && payload.purpose !== 'doc_verify') ||
      !payload.invoiceId ||
      !payload.companyId
    ) {
      throw new UnauthorizedException('Invalid share link');
    }

    return this.loadPublicDocument(
      payload.invoiceId,
      payload.companyId,
      payload.variant || 'invoice',
      payload.purpose,
    );
  }

  async resolveByPublicCode(code: string, variantHint: DocumentShareVariant = 'invoice') {
    const normalized = code.trim();
    const invoice = await this.prisma.invoice.findFirst({
      where: { publicVerifyCode: normalized },
      select: { id: true, companyId: true },
    });
    if (!invoice) throw new NotFoundException('Document not found');
    return this.loadPublicDocument(
      invoice.id,
      invoice.companyId,
      variantHint,
      'doc_verify',
    );
  }

  private async loadPublicDocument(
    invoiceId: string,
    companyId: string,
    variant: DocumentShareVariant,
    purpose: 'doc_share' | 'doc_verify',
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        contact: true,
        items: true,
        company: {
          select: {
            name: true,
            address: true,
            city: true,
            phone: true,
            email: true,
            vatNumber: true,
            crNumber: true,
            currency: true,
            logo: true,
            ftaConfig: true,
          },
        },
      },
    });

    if (!invoice) throw new NotFoundException('Document not found');

    const templateType =
      variant === 'receipt'
        ? 'RECEIPT'
        : invoice.type === 'QUOTATION'
          ? 'QUOTATION'
          : invoice.type === 'CREDIT_NOTE'
            ? 'CREDIT_NOTE'
            : 'INVOICE';

    const template = await this.prisma.documentTemplate.findFirst({
      where: {
        companyId,
        type: templateType,
        isActive: true,
        isDefault: true,
      },
      select: { headerText: true, footerText: true },
    });

    const { ftaConfig, ...companyRest } = invoice.company;
    const company = {
      ...companyRest,
      signatureMode: this.signatureModeFromCompany(ftaConfig),
      documentColor: this.documentColorFromCompany(ftaConfig),
    };

    return {
      variant,
      purpose,
      invoice,
      company,
      template,
    };
  }
}
