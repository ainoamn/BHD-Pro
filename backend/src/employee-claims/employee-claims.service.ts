import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmployeeClaimDto,
  UpdateEmployeeClaimDto,
  RejectClaimDto,
  MarkClaimPaidDto,
} from './dto/employee-claim.dto';
import { EmployeeClaimStatus, PaymentMethod } from '@prisma/client';
import { GlPostingService } from '../journal/gl-posting.service';

@Injectable()
export class EmployeeClaimsService {
  constructor(
    private prisma: PrismaService,
    private glPosting: GlPostingService,
  ) {}

  private async generateNumber(companyId: string) {
    const year = new Date().getFullYear();
    const prefix = `CL-${year}-`;
    const latest = await this.prisma.employeeClaim.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    let next = 1;
    if (latest?.number) {
      const seq = Number(latest.number.slice(prefix.length));
      if (!Number.isNaN(seq)) next = seq + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  findAll(companyId: string) {
    return this.prisma.employeeClaim.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
        bankAccount: true,
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const claim = await this.prisma.employeeClaim.findFirst({
      where: { id, companyId },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
        bankAccount: true,
      },
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return claim;
  }

  async create(companyId: string, userId: string, dto: CreateEmployeeClaimDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
    });
    if (!employee) throw new BadRequestException('Employee not found');

    const total = Number(
      dto.lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(3),
    );
    const number = await this.generateNumber(companyId);

    return this.prisma.employeeClaim.create({
      data: {
        companyId,
        number,
        date: new Date(dto.date),
        employeeId: dto.employeeId,
        notes: dto.notes,
        total,
        createdById: userId,
        lines: {
          create: dto.lines.map((l) => ({
            description: l.description,
            amount: l.amount,
            category: l.category || null,
            receiptRef: l.receiptRef || null,
          })),
        },
      },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateEmployeeClaimDto) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== EmployeeClaimStatus.DRAFT) {
      throw new BadRequestException('Only draft claims can be edited');
    }

    const data: Record<string, unknown> = {};
    if (dto.date) data.date = new Date(dto.date);
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (dto.lines) {
      const total = Number(
        dto.lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(3),
      );
      await this.prisma.employeeClaimLine.deleteMany({ where: { claimId: id } });
      data.total = total;
      data.lines = {
        create: dto.lines.map((l) => ({
          description: l.description,
          amount: l.amount,
          category: l.category || null,
          receiptRef: l.receiptRef || null,
        })),
      };
    }

    return this.prisma.employeeClaim.update({
      where: { id },
      data,
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
      },
    });
  }

  async submit(companyId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== EmployeeClaimStatus.DRAFT) {
      throw new BadRequestException('Only draft claims can be submitted');
    }
    if (!claim.lines.length || Number(claim.total) <= 0) {
      throw new BadRequestException('Claim must have line items');
    }
    return this.prisma.employeeClaim.update({
      where: { id },
      data: {
        status: EmployeeClaimStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
      },
    });
  }

  async approve(companyId: string, userId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== EmployeeClaimStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted claims can be approved');
    }
    const updated = await this.prisma.employeeClaim.update({
      where: { id },
      data: {
        status: EmployeeClaimStatus.APPROVED,
        approvedAt: new Date(),
        rejectReason: null,
      },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
      },
    });
    await this.glPosting.postClaimAccrual(companyId, userId, updated);
    return this.findOne(companyId, id);
  }

  async reject(companyId: string, userId: string, id: string, dto: RejectClaimDto) {
    const claim = await this.findOne(companyId, id);
    if (
      claim.status !== EmployeeClaimStatus.SUBMITTED &&
      claim.status !== EmployeeClaimStatus.APPROVED
    ) {
      throw new BadRequestException('Only submitted or approved claims can be rejected');
    }
    if (claim.status === EmployeeClaimStatus.APPROVED && claim.glAccrualJournalId) {
      await this.glPosting.reverseClaimAccrual(companyId, userId, claim);
    }
    return this.prisma.employeeClaim.update({
      where: { id },
      data: {
        status: EmployeeClaimStatus.REJECTED,
        rejectedAt: new Date(),
        rejectReason: dto.reason || null,
      },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
      },
    });
  }

  async markPaid(companyId: string, userId: string, id: string, dto?: MarkClaimPaidDto) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== EmployeeClaimStatus.APPROVED) {
      throw new BadRequestException('Only approved claims can be marked paid');
    }
    if (!claim.glAccrualJournalId) {
      await this.glPosting.postClaimAccrual(companyId, userId, claim);
    }

    const paymentMethod = dto?.paymentMethod || PaymentMethod.CASH;
    const bankAccountId = dto?.bankAccountId || null;
    if (bankAccountId) {
      const bank = await this.prisma.bankAccount.findFirst({
        where: { id: bankAccountId, companyId },
      });
      if (!bank) throw new BadRequestException('Bank account not found');
    }

    const paidAt = new Date();
    const updated = await this.prisma.employeeClaim.update({
      where: { id },
      data: {
        status: EmployeeClaimStatus.PAID,
        paidAt,
        paymentMethod,
        bankAccountId,
      },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
        bankAccount: true,
      },
    });
    await this.glPosting.postClaimPayment(companyId, userId, updated);
    return this.findOne(companyId, id);
  }

  async unpay(companyId: string, userId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== EmployeeClaimStatus.PAID) {
      throw new BadRequestException('Only paid claims can be unpaid');
    }
    await this.glPosting.reverseClaimPayment(companyId, userId, claim);
    return this.prisma.employeeClaim.update({
      where: { id },
      data: {
        status: EmployeeClaimStatus.APPROVED,
        paidAt: null,
        paymentMethod: null,
        bankAccountId: null,
      },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (
      claim.status !== EmployeeClaimStatus.DRAFT &&
      claim.status !== EmployeeClaimStatus.REJECTED
    ) {
      throw new BadRequestException('Only draft or rejected claims can be deleted');
    }
    if (claim.glAccrualJournalId) {
      throw new BadRequestException(
        'Cannot delete claim with accrual journal — reverse accrual first',
      );
    }
    await this.prisma.employeeClaim.delete({ where: { id } });
    return { message: 'Deleted' };
  }
}
