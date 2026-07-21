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
} from './dto/employee-claim.dto';
import { EmployeeClaimStatus } from '@prisma/client';

@Injectable()
export class EmployeeClaimsService {
  constructor(private prisma: PrismaService) {}

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

  private calcTotal(lines: { amount: number }[]) {
    return Number(lines.reduce((s, l) => s + Number(l.amount), 0).toFixed(3));
  }

  findAll(companyId: string) {
    return this.prisma.employeeClaim.findMany({
      where: { companyId },
      include: {
        employee: {
          select: { id: true, name: true, employeeNumber: true, department: true },
        },
        lines: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const row = await this.prisma.employeeClaim.findFirst({
      where: { id, companyId },
      include: {
        employee: true,
        lines: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Employee claim not found');
    return row;
  }

  async create(companyId: string, userId: string, dto: CreateEmployeeClaimDto) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId, isActive: true },
    });
    if (!employee) throw new BadRequestException('Employee not found');

    const lines = dto.lines.map((l) => ({
      description: l.description.trim(),
      amount: Number(l.amount),
      category: l.category?.trim() || null,
      receiptRef: l.receiptRef?.trim() || null,
    }));
    const total = this.calcTotal(lines);
    if (total <= 0) throw new BadRequestException('Claim total must be greater than zero');

    const number = await this.generateNumber(companyId);

    return this.prisma.employeeClaim.create({
      data: {
        companyId,
        number,
        date: new Date(dto.date),
        employeeId: dto.employeeId,
        notes: dto.notes || null,
        status: EmployeeClaimStatus.DRAFT,
        total,
        createdById: userId,
        lines: { create: lines },
      },
      include: {
        employee: { select: { id: true, name: true, employeeNumber: true } },
        lines: true,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateEmployeeClaimDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status !== EmployeeClaimStatus.DRAFT) {
      throw new BadRequestException('Only draft claims can be edited');
    }

    if (dto.lines) {
      await this.prisma.employeeClaimLine.deleteMany({ where: { claimId: id } });
      const lines = dto.lines.map((l) => ({
        claimId: id,
        description: l.description.trim(),
        amount: Number(l.amount),
        category: l.category?.trim() || null,
        receiptRef: l.receiptRef?.trim() || null,
      }));
      const total = this.calcTotal(lines);
      if (total <= 0) throw new BadRequestException('Claim total must be greater than zero');
      await this.prisma.employeeClaimLine.createMany({ data: lines });
      return this.prisma.employeeClaim.update({
        where: { id },
        data: {
          total,
          ...(dto.date ? { date: new Date(dto.date) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
        },
        include: {
          employee: { select: { id: true, name: true, employeeNumber: true } },
          lines: true,
        },
      });
    }

    return this.prisma.employeeClaim.update({
      where: { id },
      data: {
        ...(dto.date ? { date: new Date(dto.date) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {}),
      },
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

  async approve(companyId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== EmployeeClaimStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted claims can be approved');
    }
    return this.prisma.employeeClaim.update({
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
  }

  async reject(companyId: string, id: string, dto: RejectClaimDto) {
    const claim = await this.findOne(companyId, id);
    if (
      claim.status !== EmployeeClaimStatus.SUBMITTED &&
      claim.status !== EmployeeClaimStatus.APPROVED
    ) {
      throw new BadRequestException('Only submitted or approved claims can be rejected');
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

  async markPaid(companyId: string, id: string) {
    const claim = await this.findOne(companyId, id);
    if (claim.status !== EmployeeClaimStatus.APPROVED) {
      throw new BadRequestException('Only approved claims can be marked paid');
    }
    return this.prisma.employeeClaim.update({
      where: { id },
      data: {
        status: EmployeeClaimStatus.PAID,
        paidAt: new Date(),
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
    await this.prisma.employeeClaim.delete({ where: { id } });
    return { message: 'Deleted' };
  }
}
