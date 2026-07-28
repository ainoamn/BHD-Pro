import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  PaymentGatewaySlug,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { CompanyGatewaysService } from '../payments/company-gateways.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CustomerNotifyService } from '../notifications/customer-notify.service';

export type TerminalTapMode = 'mock' | 'hosted' | 'softpos';

@Injectable()
export class TerminalTapService {
  private readonly logger = new Logger(TerminalTapService.name);

  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
    private companyGateways: CompanyGatewaysService,
    private invoices: InvoicesService,
    private customerNotify: CustomerNotifyService,
  ) {}

  preferredMode(): TerminalTapMode {
    const raw = (process.env.POS_TERMINAL_MODE || 'hosted').toLowerCase();
    if (raw === 'mock' || raw === 'softpos' || raw === 'hosted') return raw;
    return 'hosted';
  }

  async startSession(opts: {
    companyId: string;
    invoiceId: string;
    gatewaySlug?: PaymentGatewaySlug;
    customerEmail?: string;
    mode?: TerminalTapMode;
  }) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: opts.invoiceId, companyId: opts.companyId },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        paidAmount: true,
        notes: true,
        customFieldsJson: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice is cancelled');
    }
    const due = Number(invoice.total) - Number(invoice.paidAmount || 0);
    if (due <= 0.0005) {
      throw new BadRequestException('Invoice is already paid');
    }
    if (!String(invoice.notes || '').includes('[PARTNER_PAY]')) {
      throw new BadRequestException(
        'Terminal tap requires a partner-pay POS invoice — create sale with partnerCheckout first',
      );
    }

    const mode = opts.mode || this.preferredMode();
    const sessionId = `tap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const prev =
      invoice.customFieldsJson &&
      typeof invoice.customFieldsJson === 'object' &&
      !Array.isArray(invoice.customFieldsJson)
        ? (invoice.customFieldsJson as Record<string, unknown>)
        : {};

    if (mode === 'mock') {
      const session = {
        sessionId,
        mode: 'mock' as const,
        status: 'PENDING' as const,
        amount: due,
        createdAt: new Date().toISOString(),
        provider: 'hisaby_mock_terminal',
        noteAr:
          'وضع تجريبي: اضغط «تأكيد النقر» بعد أن يلمس العميل الجهاز الوهمي.',
      };
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { customFieldsJson: { ...prev, terminalTap: session } },
      });
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        ...session,
        checkoutUrl: null as string | null,
        softposDeepLink: null as string | null,
      };
    }

    let slug = opts.gatewaySlug;
    if (!slug) {
      const enabled = await this.companyGateways.listEnabled(opts.companyId);
      slug = enabled[0]?.slug as PaymentGatewaySlug | undefined;
    }
    if (!slug) {
      throw new BadRequestException(
        'No enabled company payment gateway — configure Thawani/Stripe/PayPal first',
      );
    }

    const checkout = await this.payments.createInvoiceCollectionCheckout({
      companyId: opts.companyId,
      invoiceId: invoice.id,
      gatewaySlug: slug as any,
      customerEmail: opts.customerEmail,
    });
    const checkoutUrl = (checkout as { checkoutUrl?: string })?.checkoutUrl || null;
    const softposDeepLink =
      mode === 'softpos' && process.env.POS_SOFTPOS_DEEP_LINK_TEMPLATE
        ? process.env.POS_SOFTPOS_DEEP_LINK_TEMPLATE.replace('{invoiceId}', invoice.id)
            .replace('{amount}', String(due))
            .replace('{sessionId}', sessionId)
        : null;

    const session = {
      sessionId,
      mode,
      status: 'PENDING' as const,
      amount: due,
      createdAt: new Date().toISOString(),
      provider: String(slug),
      checkoutUrl,
      softposDeepLink,
      noteAr:
        mode === 'softpos'
          ? 'افتح رابط SoftPOS على جهاز الطرف / الهاتف لالتقاط الدفع باللمس.'
          : 'افتح صفحة الدفع للعميل (بطاقة/محفظة) — مسار شريك وليس شارة NFC للموافقة.',
    };

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { customFieldsJson: { ...prev, terminalTap: session } },
    });
    this.logger.log(`Terminal tap session ${sessionId} mode=${mode} invoice=${invoice.number}`);
    return { invoiceId: invoice.id, invoiceNumber: invoice.number, ...session };
  }

  async getSession(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        number: true,
        status: true,
        total: true,
        paidAmount: true,
        customFieldsJson: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const fields =
      invoice.customFieldsJson &&
      typeof invoice.customFieldsJson === 'object' &&
      !Array.isArray(invoice.customFieldsJson)
        ? (invoice.customFieldsJson as Record<string, unknown>)
        : {};
    const tap = (fields.terminalTap || null) as Record<string, unknown> | null;
    const paid =
      Number(invoice.paidAmount || 0) + 0.0005 >= Number(invoice.total) ||
      invoice.status === InvoiceStatus.PAID;
    let customerNotify =
      (fields.partnerPayNotify as {
        whatsapp?: string;
        email?: string;
        sms?: string;
      } | null) || null;
    if (paid && !customerNotify) {
      customerNotify = await this.customerNotify.notifyPosPartnerPayOnce(
        companyId,
        invoice.id,
      );
    }
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      invoiceStatus: invoice.status,
      paid,
      session: tap ? { ...tap, status: paid ? 'CAPTURED' : tap.status } : null,
      customerNotify: customerNotify ?? null,
    };
  }

  async confirmMockTap(companyId: string, invoiceId: string, userId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        customFieldsJson: true,
        notes: true,
        total: true,
        paidAmount: true,
        status: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const fields =
      invoice.customFieldsJson &&
      typeof invoice.customFieldsJson === 'object' &&
      !Array.isArray(invoice.customFieldsJson)
        ? (invoice.customFieldsJson as Record<string, unknown>)
        : {};
    const tap = fields.terminalTap as Record<string, unknown> | undefined;
    if (!tap || tap.mode !== 'mock') {
      throw new BadRequestException('Only mock terminal sessions can be confirmed here');
    }

    const due = Number((Number(invoice.total) - Number(invoice.paidAmount || 0)).toFixed(3));
    if (due > 0.0005) {
      const today = new Date().toISOString().slice(0, 10);
      await this.invoices.recordPayment(companyId, userId, invoice.id, {
        method: PaymentMethod.ONLINE,
        amount: due,
        date: today,
        notes: 'Terminal tap mock capture',
        reference: String(tap.sessionId || 'mock-tap'),
      });
    }

    const refreshed = await this.prisma.invoice.findUnique({
      where: { id: invoice.id },
      select: { customFieldsJson: true, notes: true },
    });
    const nextFields =
      refreshed?.customFieldsJson &&
      typeof refreshed.customFieldsJson === 'object' &&
      !Array.isArray(refreshed.customFieldsJson)
        ? (refreshed.customFieldsJson as Record<string, unknown>)
        : fields;

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        customFieldsJson: {
          ...nextFields,
          terminalTap: { ...tap, status: 'CAPTURED', capturedAt: new Date().toISOString() },
        },
        notes: `${refreshed?.notes || invoice.notes || ''}\n[TERMINAL_TAP_MOCK_CAPTURED]`.trim(),
      },
    });

    const customerNotify = await this.customerNotify.notifyPosPartnerPayOnce(
      companyId,
      invoice.id,
    );

    return {
      ok: true,
      status: 'CAPTURED',
      paid: true,
      paymentStatus: PaymentStatus.PAID,
      customerNotify: customerNotify ?? null,
    };
  }
}
