import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BillingInvoiceStatus,
  BillingPurpose,
  InvoiceStatus,
  PaymentGatewaySlug,
  PaymentMethod,
  PaymentStatus,
  Plan,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_DETAILS } from '../subscriptions/subscriptions.service';
import { getPaymentAdapter } from './adapters';
import { GATEWAY_META, ONLINE_GATEWAYS } from './gateway.constants';
import { baisaToOmr, CheckoutInput, omrToBaisa } from './payment.types';
import { PlatformGatewaysService } from './platform-gateways.service';
import { CompanyGatewaysService } from './company-gateways.service';

type GatewayRecord = {
  slug: PaymentGatewaySlug;
  isEnabled: boolean;
  isTestMode: boolean;
  configJson: unknown;
};

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private platformGateways: PlatformGatewaysService,
    private companyGateways: CompanyGatewaysService,
  ) {}

  private getOrigin(): string {
    return process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:3000';
  }

  private async generateBillingNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PAY-${year}-`;
    const latest = await this.prisma.billingInvoice.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    let next = 1;
    if (latest?.number) {
      const match = latest.number.match(/-(\d+)$/);
      if (match) next = parseInt(match[1], 10) + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  private configOf(gateway: GatewayRecord): Record<string, string> {
    return this.platformGateways.decryptedConfig(gateway);
  }

  async listPlatformGatewaysPublic() {
    const gateways = await this.platformGateways.listEnabled();
    return gateways.map((g) => this.platformGateways.toPublic(g));
  }

  async listCompanyGatewaysPublic(companyId: string) {
    const gateways = await this.companyGateways.listEnabled(companyId);
    return gateways.map((g) => {
      const meta = GATEWAY_META[g.slug];
      return {
        slug: g.slug,
        nameAr: meta.nameAr,
        nameEn: meta.nameEn,
        isTestMode: g.isTestMode,
      };
    });
  }

  async createSubscriptionCheckout(opts: {
    companyId: string;
    userEmail: string;
    plan: Plan;
    billing: 'monthly' | 'yearly';
    gatewaySlug: PaymentGatewaySlug;
  }) {
    const gateway = await this.platformGateways.getBySlug(opts.gatewaySlug);
    if (!gateway.isEnabled) {
      throw new BadRequestException('Payment gateway is not enabled');
    }

    const planDetails = PLAN_DETAILS[opts.plan];
    const priceOmr =
      opts.billing === 'yearly' ? planDetails.yearlyPrice : planDetails.monthlyPrice;
    const amountBaisa = omrToBaisa(priceOmr);

    if (amountBaisa <= 0) {
      throw new BadRequestException('Invalid plan price');
    }

    const number = await this.generateBillingNumber(opts.companyId);
    const description = `BHD Pro — ${planDetails.nameEn} (${opts.billing})`;

    const billingInvoice = await this.prisma.billingInvoice.create({
      data: {
        companyId: opts.companyId,
        number,
        purpose: BillingPurpose.SUBSCRIPTION,
        description,
        amount: baisaToOmr(amountBaisa),
        currency: 'OMR',
        gatewaySlug: opts.gatewaySlug,
        metadataJson: {
          plan: opts.plan,
          billing: opts.billing,
        },
      },
    });

    if (amountBaisa === 0) {
      await this.fulfillBillingInvoice(billingInvoice.id);
      return {
        invoiceNumber: number,
        checkout: { kind: 'free' as const },
      };
    }

    const apiOrigin = process.env.API_PUBLIC_URL || 'http://localhost:3001';
    const frontendOrigin = this.getOrigin();
    const gwKey = opts.gatewaySlug.toLowerCase();
    let successUrl = `${apiOrigin}/api/payments/checkout/complete?invoice=${encodeURIComponent(number)}&gateway=${gwKey}`;
    if (opts.gatewaySlug === PaymentGatewaySlug.STRIPE) {
      successUrl += '&session_id={CHECKOUT_SESSION_ID}';
    }
    if (opts.gatewaySlug === PaymentGatewaySlug.THAWANI) {
      successUrl += '&session_id={CHECKOUT_SESSION_ID}';
    }

    const checkout = await this.runCheckout(gateway, {
      invoiceNumber: number,
      invoiceId: billingInvoice.id,
      amountBaisa,
      currency: 'OMR',
      description,
      customerEmail: opts.userEmail,
      successUrl,
      cancelUrl: `${frontendOrigin}/subscription?cancelled=1`,
      metadata: { invoice_number: number, purpose: 'subscription' },
    });

    await this.prisma.billingInvoice.update({
      where: { id: billingInvoice.id },
      data: {
        externalPaymentId: checkout.externalId,
        checkoutUrl: checkout.redirectUrl,
      },
    });

    return { invoiceNumber: number, checkout, amount: baisaToOmr(amountBaisa), currency: 'OMR' };
  }

  async createInvoiceCollectionCheckout(opts: {
    companyId: string;
    invoiceId: string;
    gatewaySlug: PaymentGatewaySlug;
    customerEmail?: string;
  }) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: opts.invoiceId, companyId: opts.companyId },
      include: { contact: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED || invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice cannot be paid');
    }
    if (invoice.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Invoice already paid');
    }

    const gateway = await this.companyGateways.get(opts.companyId, opts.gatewaySlug);
    if (!gateway.isEnabled) {
      throw new BadRequestException('Payment gateway is not enabled for this company');
    }

    const remaining = Number(invoice.total) - Number(invoice.paidAmount || 0);
    const amountBaisa = omrToBaisa(remaining);
    if (amountBaisa <= 0) throw new BadRequestException('Nothing to pay');

    const number = await this.generateBillingNumber(opts.companyId);
    const description = `Invoice ${invoice.number} — ${invoice.contact.name}`;

    const billingInvoice = await this.prisma.billingInvoice.create({
      data: {
        companyId: opts.companyId,
        number,
        purpose: BillingPurpose.INVOICE_COLLECTION,
        description,
        amount: remaining,
        currency: 'OMR',
        gatewaySlug: opts.gatewaySlug,
        metadataJson: { invoiceId: invoice.id, invoiceNumber: invoice.number },
      },
    });

    const apiOrigin = process.env.API_PUBLIC_URL || 'http://localhost:3001';
    const frontendOrigin = this.getOrigin();
    const gwKey = opts.gatewaySlug.toLowerCase();
    let successUrl = `${apiOrigin}/api/payments/checkout/complete?invoice=${encodeURIComponent(number)}&gateway=${gwKey}`;
    if (opts.gatewaySlug === PaymentGatewaySlug.STRIPE) {
      successUrl += '&session_id={CHECKOUT_SESSION_ID}';
    }

    const checkout = await this.runCheckout(gateway, {
      invoiceNumber: number,
      invoiceId: billingInvoice.id,
      amountBaisa,
      currency: 'OMR',
      description,
      customerEmail: opts.customerEmail || invoice.contact.email || undefined,
      customerName: invoice.contact.name,
      successUrl,
      cancelUrl: `${frontendOrigin}/pay/${invoice.id}?cancelled=1`,
      metadata: { invoice_number: number, sales_invoice_id: invoice.id },
    });

    await this.prisma.billingInvoice.update({
      where: { id: billingInvoice.id },
      data: {
        externalPaymentId: checkout.externalId,
        checkoutUrl: checkout.redirectUrl,
      },
    });

    return {
      invoiceNumber: number,
      checkout,
      amount: remaining,
      currency: 'OMR',
      salesInvoiceNumber: invoice.number,
    };
  }

  private async runCheckout(gateway: GatewayRecord, input: CheckoutInput) {
    const adapter = getPaymentAdapter(gateway.slug);
    const config = this.configOf(gateway);
    const result = await adapter.createCheckout(config, input, gateway.isTestMode);

    if (result.kind === 'offline') {
      return {
        kind: result.kind,
        instructions: result.instructions,
        bankDetails: result.bankDetails,
      };
    }

    return {
      kind: result.kind,
      redirectUrl: result.redirectUrl,
      externalId: result.externalId,
    };
  }

  async completeCheckout(query: Record<string, string>) {
    const invoiceNumber = query.invoice;
    const gatewaySlug = (query.gateway || '').toUpperCase() as PaymentGatewaySlug;
    if (!invoiceNumber || !gatewaySlug) {
      throw new BadRequestException('Missing invoice or gateway');
    }

    const billingInvoice = await this.prisma.billingInvoice.findUnique({
      where: { number: invoiceNumber },
    });
    if (!billingInvoice) throw new NotFoundException('Payment not found');
    if (billingInvoice.status === BillingInvoiceStatus.PAID) {
      return { paid: true, invoiceNumber, purpose: billingInvoice.purpose };
    }

    let gateway: GatewayRecord;
    if (billingInvoice.purpose === BillingPurpose.SUBSCRIPTION) {
      gateway = await this.platformGateways.getBySlug(gatewaySlug);
    } else {
      gateway = await this.companyGateways.get(billingInvoice.companyId, gatewaySlug);
    }

    const adapter = getPaymentAdapter(gatewaySlug);
    if (!adapter.verifyReturn) {
      throw new BadRequestException('Gateway does not support return verification');
    }

    const verified = await adapter.verifyReturn(
      this.configOf(gateway),
      query,
      gateway.isTestMode,
    );

    if (verified.paid) {
      await this.fulfillBillingInvoice(billingInvoice.id, verified.externalId);
    }

    return {
      paid: verified.paid,
      invoiceNumber,
      purpose: billingInvoice.purpose,
    };
  }

  async handleWebhook(
    gatewaySlug: PaymentGatewaySlug,
    rawBody: string,
    headers: Record<string, string>,
    scope: 'platform' | 'company',
    companyId?: string,
  ) {
    if (!ONLINE_GATEWAYS.includes(gatewaySlug)) return { ok: true, skipped: true };

    let gateway: GatewayRecord;
    if (scope === 'platform') {
      gateway = await this.platformGateways.getBySlug(gatewaySlug);
    } else {
      if (!companyId) return { ok: false };
      gateway = await this.companyGateways.get(companyId, gatewaySlug);
    }

    const adapter = getPaymentAdapter(gatewaySlug);
    if (!adapter.handleWebhook) return { ok: true, skipped: true };

    const result = await adapter.handleWebhook(
      this.configOf(gateway),
      rawBody,
      headers,
      gateway.isTestMode,
    );

    if (result?.paid && result.invoiceNumber) {
      const billingInvoice = await this.prisma.billingInvoice.findUnique({
        where: { number: result.invoiceNumber },
      });
      if (billingInvoice && billingInvoice.status !== BillingInvoiceStatus.PAID) {
        await this.fulfillBillingInvoice(billingInvoice.id, result.externalId);
      }
    }

    return { ok: true };
  }

  async fulfillBillingInvoice(billingInvoiceId: string, externalId?: string) {
    const billingInvoice = await this.prisma.billingInvoice.findUnique({
      where: { id: billingInvoiceId },
    });
    if (!billingInvoice) return;
    if (billingInvoice.status === BillingInvoiceStatus.PAID) return;

    await this.prisma.billingInvoice.update({
      where: { id: billingInvoiceId },
      data: {
        status: BillingInvoiceStatus.PAID,
        paidAt: new Date(),
        ...(externalId && { externalPaymentId: externalId }),
      },
    });

    const metadata = (billingInvoice.metadataJson as Record<string, string>) || {};

    if (billingInvoice.purpose === BillingPurpose.SUBSCRIPTION) {
      const plan = metadata.plan as Plan;
      const billing = metadata.billing as 'monthly' | 'yearly';
      const expiry = new Date();
      if (billing === 'yearly') expiry.setFullYear(expiry.getFullYear() + 1);
      else expiry.setMonth(expiry.getMonth() + 1);

      await this.prisma.company.update({
        where: { id: billingInvoice.companyId },
        data: { plan, planExpiry: expiry },
      });
    }

    if (billingInvoice.purpose === BillingPurpose.INVOICE_COLLECTION && metadata.invoiceId) {
      const salesInvoice = await this.prisma.invoice.findUnique({
        where: { id: metadata.invoiceId },
      });
      if (salesInvoice) {
        const total = Number(salesInvoice.total);
        await this.prisma.payment.create({
          data: {
            invoiceId: salesInvoice.id,
            amount: billingInvoice.amount,
            method: PaymentMethod.ONLINE,
            date: new Date(),
            reference: billingInvoice.number,
            notes: `Online payment via ${billingInvoice.gatewaySlug}`,
          },
        });
        await this.prisma.invoice.update({
          where: { id: salesInvoice.id },
          data: {
            paidAmount: total,
            paymentStatus: PaymentStatus.PAID,
            status: InvoiceStatus.PAID,
          },
        });
      }
    }
  }

  async getBillingInvoice(companyId: string | null, number: string) {
    const invoice = await this.prisma.billingInvoice.findUnique({
      where: { number },
    });
    if (!invoice) throw new NotFoundException('Payment not found');
    if (companyId && invoice.companyId !== companyId) {
      throw new NotFoundException('Payment not found');
    }
    return invoice;
  }

  async getPublicInvoicePayInfo(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        contact: { select: { name: true } },
        company: { select: { id: true, name: true, currency: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED || invoice.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Invoice is not payable');
    }

    const gateways = await this.listCompanyGatewaysPublic(invoice.companyId);
    const remaining = Number(invoice.total) - Number(invoice.paidAmount || 0);

    return {
      id: invoice.id,
      number: invoice.number,
      companyId: invoice.companyId,
      companyName: invoice.company.name,
      contactName: invoice.contact.name,
      total: Number(invoice.total),
      remaining,
      currency: invoice.company.currency || 'OMR',
      gateways,
    };
  }
}
