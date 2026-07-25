import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { AdjustStoreCreditDto } from './dto/adjust-store-credit.dto';
import { ContactType, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { GlPostingService } from '../journal/gl-posting.service';
import {
  dialCodeForCountry,
  isValidMobileE164,
  toE164Digits,
} from '../common/phone';

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
    private glPosting: GlPostingService,
  ) {}

  async findAll(companyId: string, type?: ContactType, q?: string) {
    const term = q?.trim() || '';
    const digits = term.replace(/\D/g, '');
    const contacts = await this.prisma.contact.findMany({
      where: {
        companyId,
        isActive: true,
        ...(type
          ? {
              type: {
                in:
                  type === 'CUSTOMER'
                    ? ['CUSTOMER', 'BOTH']
                    : type === 'SUPPLIER'
                      ? ['SUPPLIER', 'BOTH']
                      : [type],
              },
            }
          : {}),
        ...(term
          ? {
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { nameEn: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
                { email: { contains: term, mode: 'insensitive' } },
                ...(digits.length >= 3
                  ? [{ phone: { contains: digits, mode: 'insensitive' as const } }]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: term ? 40 : undefined,
    });

    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        type: { notIn: ['QUOTATION'] },
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        status: { not: InvoiceStatus.CANCELLED },
      },
      select: { contactId: true, type: true, total: true, paidAmount: true },
    });

    type BalanceAgg = { receivable: number; payable: number };
    const balanceMap = new Map<string, BalanceAgg>();

    for (const inv of openInvoices) {
      const remaining = Math.max(
        0,
        Number(inv.total) - Number(inv.paidAmount || 0),
      );
      if (remaining <= 0) continue;

      const cur = balanceMap.get(inv.contactId) || { receivable: 0, payable: 0 };
      if (inv.type === 'SALES') {
        cur.receivable += remaining;
      } else if (inv.type === 'PURCHASE') {
        cur.payable += remaining;
      } else if (inv.type === 'CREDIT_NOTE') {
        cur.receivable = Math.max(0, cur.receivable - remaining);
      } else if (inv.type === 'DEBIT_NOTE') {
        cur.payable = Math.max(0, cur.payable - remaining);
      }
      balanceMap.set(inv.contactId, cur);
    }

    return contacts.map((c) => {
      const bal = balanceMap.get(c.id) || { receivable: 0, payable: 0 };
      const net = bal.receivable - bal.payable;
      return {
        ...c,
        receivableBalance: bal.receivable,
        payableBalance: bal.payable,
        outstandingBalance: net,
        storeCreditBalance: Number(c.currentBalance || 0),
      };
    });
  }

  async create(companyId: string, userId: string, dto: CreateContactDto) {
    await this.subscriptions.assertSubscriptionActive(companyId);
    const { customFieldsJson, openingBalance, creditLimit, country, phone, ...rest } =
      dto;
    const opening = Number(openingBalance || 0);
    const limit =
      creditLimit !== undefined && creditLimit !== null
        ? Number(creditLimit)
        : 0;

    if (opening < -0.0005) {
      throw new BadRequestException('Opening balance cannot be negative');
    }
    if (limit > 0 && opening > limit + 0.001) {
      throw new BadRequestException('Opening balance exceeds credit limit');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { country: true },
    });
    const companyCountry = company?.country || 'OM';
    const contactCountry = (country?.trim() || companyCountry).toUpperCase();
    const dial = dialCodeForCountry(companyCountry);

    const isCustomer =
      dto.type === ContactType.CUSTOMER || dto.type === ContactType.BOTH;
    let normalizedPhone: string | null = null;
    if (phone?.trim()) {
      const digits = toE164Digits(phone, dial);
      if (!isValidMobileE164(digits)) {
        throw new BadRequestException(
          'Invalid phone number — use international format with country code',
        );
      }
      normalizedPhone = `+${digits}`;
    } else if (isCustomer) {
      throw new BadRequestException(
        'Phone is required for customers (رقم الهاتف مطلوب للعملاء)',
      );
    }

    const contact = await this.prisma.contact.create({
      data: {
        ...rest,
        companyId,
        country: contactCountry,
        phone: normalizedPhone,
        openingBalance: opening,
        currentBalance: opening,
        creditLimit: limit,
        ...(customFieldsJson !== undefined
          ? { customFieldsJson: customFieldsJson as object }
          : {}),
      },
    });

    if (opening > 0.0005) {
      await this.glPosting.postStoreCreditFunding(companyId, userId, {
        contactId: contact.id,
        contactName: contact.name,
        amount: opening,
        notes: 'Opening store credit',
        reference: `SC-OPEN:${contact.id}`,
      });
    }

    return contact;
  }

  async findOne(companyId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, companyId },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(companyId: string, id: string, dto: UpdateContactDto) {
    await this.findOne(companyId, id);
    // Wallet balance must change via adjustStoreCredit (keeps GL in sync)
    const {
      customFieldsJson,
      currentBalance: _ignoredBalance,
      openingBalance: _ignoredOpening,
      ...rest
    } = dto;
    return this.prisma.contact.update({
      where: { id },
      data: {
        ...rest,
        ...(customFieldsJson !== undefined
          ? { customFieldsJson: customFieldsJson as object }
          : {}),
      },
    });
  }

  async adjustStoreCredit(
    companyId: string,
    userId: string,
    id: string,
    dto: AdjustStoreCreditDto,
  ) {
    const contact = await this.findOne(companyId, id);
    if (contact.type === 'SUPPLIER') {
      throw new BadRequestException('Store credit applies to customers only');
    }

    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || Math.abs(amount) < 0.0005) {
      throw new BadRequestException('Amount must be non-zero');
    }

    const current = Number(contact.currentBalance || 0);
    const next = Number((current + amount).toFixed(3));
    if (next < -0.0005) {
      throw new BadRequestException(
        `Insufficient store credit: balance ${current.toFixed(3)}`,
      );
    }

    const limit = Number(contact.creditLimit || 0);
    if (limit > 0 && next > limit + 0.001) {
      throw new BadRequestException(
        `Exceeds credit limit ${limit.toFixed(3)} (would be ${next.toFixed(3)})`,
      );
    }

    if (dto.bankAccountId) {
      const bank = await this.prisma.bankAccount.findFirst({
        where: { id: dto.bankAccountId, companyId },
      });
      if (!bank) throw new BadRequestException('Bank account not found');
    }

    const updated = await this.prisma.contact.update({
      where: { id },
      data: { currentBalance: next },
    });

    await this.glPosting.postStoreCreditFunding(companyId, userId, {
      contactId: id,
      contactName: contact.name,
      amount,
      notes: dto.notes,
      bankAccountId: dto.bankAccountId,
      reference: `SC-ADJ:${id}:${Date.now()}`,
    });

    return updated;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.contact.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
