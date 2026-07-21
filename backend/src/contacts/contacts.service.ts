import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactType, InvoiceStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class ContactsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, type?: ContactType) {
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
      },
      orderBy: { name: 'asc' },
    });

    const openInvoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        status: { not: InvoiceStatus.CANCELLED },
      },
      select: { contactId: true, type: true, total: true },
    });

    type BalanceAgg = { receivable: number; payable: number };
    const balanceMap = new Map<string, BalanceAgg>();

    for (const inv of openInvoices) {
      const cur = balanceMap.get(inv.contactId) || { receivable: 0, payable: 0 };
      const amount = Number(inv.total);
      if (inv.type === 'SALES') {
        cur.receivable += amount;
      } else if (inv.type === 'PURCHASE') {
        cur.payable += amount;
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
      };
    });
  }

  async create(companyId: string, dto: CreateContactDto) {
    const { customFieldsJson, ...rest } = dto;
    return this.prisma.contact.create({
      data: {
        ...rest,
        companyId,
        country: 'OM',
        ...(customFieldsJson !== undefined
          ? { customFieldsJson: customFieldsJson as object }
          : {}),
      },
    });
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
    const { customFieldsJson, ...rest } = dto;
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

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.contact.update({ where: { id }, data: { isActive: false } });
  }
}
