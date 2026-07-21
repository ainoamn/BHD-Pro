import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BranchDto,
  CostCenterDto,
  ProjectDto,
  EmployeeDto,
  AssetDto,
  BankAccountDto,
  BankStatementLineDto,
  CreatePayrollDto,
} from './dto/erp.dto';
import { AccountCategory, AccountType, PayrollStatus } from '@prisma/client';
import { GlPostingService } from '../journal/gl-posting.service';

@Injectable()
export class ErpService {
  constructor(
    private prisma: PrismaService,
    private glPosting: GlPostingService,
  ) {}

  // ─── Branches ───
  findBranches(companyId: string) {
    return this.prisma.branch.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }

  async createBranch(companyId: string, dto: BranchDto) {
    const dup = await this.prisma.branch.findFirst({ where: { companyId, code: dto.code } });
    if (dup) throw new ConflictException('Branch code exists');
    if (dto.isHeadOffice) {
      await this.prisma.branch.updateMany({
        where: { companyId },
        data: { isHeadOffice: false },
      });
    }
    return this.prisma.branch.create({ data: { ...dto, companyId } });
  }

  async updateBranch(companyId: string, id: string, dto: Partial<BranchDto>) {
    await this.ensureBranch(companyId, id);
    if (dto.isHeadOffice) {
      await this.prisma.branch.updateMany({
        where: { companyId, NOT: { id } },
        data: { isHeadOffice: false },
      });
    }
    return this.prisma.branch.update({ where: { id }, data: dto });
  }

  async deleteBranch(companyId: string, id: string) {
    await this.ensureBranch(companyId, id);
    await this.prisma.branch.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private async ensureBranch(companyId: string, id: string) {
    const row = await this.prisma.branch.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Branch not found');
    return row;
  }

  // ─── Cost Centers ───
  findCostCenters(companyId: string) {
    return this.prisma.costCenter.findMany({
      where: { companyId },
      include: { branch: { select: { id: true, name: true, code: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async createCostCenter(companyId: string, dto: CostCenterDto) {
    const dup = await this.prisma.costCenter.findFirst({ where: { companyId, code: dto.code } });
    if (dup) throw new ConflictException('Cost center code exists');
    return this.prisma.costCenter.create({ data: { ...dto, companyId } });
  }

  async updateCostCenter(companyId: string, id: string, dto: Partial<CostCenterDto>) {
    await this.ensureCostCenter(companyId, id);
    return this.prisma.costCenter.update({ where: { id }, data: dto });
  }

  async deleteCostCenter(companyId: string, id: string) {
    await this.ensureCostCenter(companyId, id);
    await this.prisma.costCenter.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private async ensureCostCenter(companyId: string, id: string) {
    const row = await this.prisma.costCenter.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Cost center not found');
    return row;
  }

  // ─── Projects ───
  findProjects(companyId: string) {
    return this.prisma.project.findMany({
      where: { companyId },
      include: {
        branch: { select: { id: true, name: true } },
        costCenter: { select: { id: true, name: true, code: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createProject(companyId: string, dto: ProjectDto) {
    const dup = await this.prisma.project.findFirst({ where: { companyId, code: dto.code } });
    if (dup) throw new ConflictException('Project code exists');
    return this.prisma.project.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        description: dto.description,
        branchId: dto.branchId,
        costCenterId: dto.costCenterId,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        budget: dto.budget ?? 0,
        status: dto.status,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateProject(companyId: string, id: string, dto: Partial<ProjectDto>) {
    await this.ensureProject(companyId, id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return this.prisma.project.update({ where: { id }, data });
  }

  async deleteProject(companyId: string, id: string) {
    await this.ensureProject(companyId, id);
    await this.prisma.project.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private async ensureProject(companyId: string, id: string) {
    const row = await this.prisma.project.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Project not found');
    return row;
  }

  // ─── Employees ───
  findEmployees(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { employeeNumber: 'asc' },
    });
  }

  async createEmployee(companyId: string, dto: EmployeeDto) {
    const dup = await this.prisma.employee.findFirst({
      where: { companyId, employeeNumber: dto.employeeNumber },
    });
    if (dup) throw new ConflictException('Employee number exists');
    return this.prisma.employee.create({
      data: {
        companyId,
        employeeNumber: dto.employeeNumber,
        name: dto.name,
        nameEn: dto.nameEn,
        email: dto.email,
        phone: dto.phone,
        jobTitle: dto.jobTitle,
        department: dto.department,
        baseSalary: dto.baseSalary ?? 0,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : null,
        branchId: dto.branchId,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateEmployee(companyId: string, id: string, dto: Partial<EmployeeDto>) {
    await this.ensureEmployee(companyId, id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.hireDate) data.hireDate = new Date(dto.hireDate);
    return this.prisma.employee.update({ where: { id }, data });
  }

  async deleteEmployee(companyId: string, id: string) {
    await this.ensureEmployee(companyId, id);
    await this.prisma.employee.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private async ensureEmployee(companyId: string, id: string) {
    const row = await this.prisma.employee.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Employee not found');
    return row;
  }

  // ─── Fixed Assets ───
  findAssets(companyId: string) {
    return this.prisma.fixedAsset.findMany({
      where: { companyId },
      include: {
        branch: { select: { id: true, name: true } },
        account: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createAsset(companyId: string, dto: AssetDto) {
    const dup = await this.prisma.fixedAsset.findFirst({ where: { companyId, code: dto.code } });
    if (dup) throw new ConflictException('Asset code exists');
    const cost = dto.purchaseCost ?? 0;
    return this.prisma.fixedAsset.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        category: dto.category,
        branchId: dto.branchId,
        accountId: dto.accountId,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        purchaseCost: cost,
        currentValue: dto.currentValue ?? cost,
        depreciationRate: dto.depreciationRate ?? 0,
        location: dto.location,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateAsset(companyId: string, id: string, dto: Partial<AssetDto>) {
    await this.ensureAsset(companyId, id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.purchaseDate) data.purchaseDate = new Date(dto.purchaseDate);
    return this.prisma.fixedAsset.update({ where: { id }, data });
  }

  async deleteAsset(companyId: string, id: string) {
    await this.ensureAsset(companyId, id);
    await this.prisma.fixedAsset.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  async depreciateAsset(companyId: string, userId: string, id: string) {
    const asset = await this.ensureAsset(companyId, id);
    const rate = Number(asset.depreciationRate || 0);
    if (rate <= 0) {
      throw new BadRequestException('Asset has no depreciation rate');
    }
    const cost = Number(asset.purchaseCost);
    const current = Number(asset.currentValue);
    if (current <= 0) {
      throw new BadRequestException('Asset is already fully depreciated');
    }

    // Straight-line monthly: annual rate / 12 applied to purchase cost
    const monthly = Number(((cost * rate) / 100 / 12).toFixed(3));
    if (monthly <= 0) {
      throw new BadRequestException('Depreciation amount is zero');
    }

    const amount = Math.min(monthly, current);
    const nextValue = Number((current - amount).toFixed(3));

    const updated = await this.prisma.fixedAsset.update({
      where: { id },
      data: { currentValue: nextValue },
    });

    await this.glPosting.postAssetDepreciation(
      companyId,
      userId,
      {
        id: asset.id,
        code: asset.code,
        name: asset.name,
        accountId: asset.accountId,
      },
      amount,
    );

    return updated;
  }

  private async ensureAsset(companyId: string, id: string) {
    const row = await this.prisma.fixedAsset.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Asset not found');
    return row;
  }

  // ─── Bank Accounts ───
  findBankAccounts(companyId: string) {
    return this.prisma.bankAccount.findMany({
      where: { companyId },
      include: {
        branch: { select: { id: true, name: true } },
        glAccount: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createBankAccount(companyId: string, dto: BankAccountDto) {
    const opening = dto.openingBalance ?? 0;
    let glAccountId = dto.accountId;

    if (!glAccountId) {
      const code = `12${Date.now().toString().slice(-4)}`;
      const gl = await this.prisma.account.create({
        data: {
          companyId,
          code,
          name: dto.name,
          type: AccountType.ASSET,
          category: AccountCategory.CURRENT_ASSET,
          isBank: true,
          bankName: dto.bankName,
          bankAccount: dto.accountNumber,
          openingBalance: opening,
          currentBalance: opening,
        },
      });
      glAccountId = gl.id;
    }

    return this.prisma.bankAccount.create({
      data: {
        companyId,
        name: dto.name,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        iban: dto.iban,
        currency: dto.currency ?? 'OMR',
        openingBalance: opening,
        currentBalance: opening,
        branchId: dto.branchId,
        accountId: glAccountId,
        isActive: dto.isActive ?? true,
      },
      include: { glAccount: true, branch: true },
    });
  }

  async updateBankAccount(companyId: string, id: string, dto: Partial<BankAccountDto>) {
    await this.ensureBankAccount(companyId, id);
    return this.prisma.bankAccount.update({ where: { id }, data: dto });
  }

  async deleteBankAccount(companyId: string, id: string) {
    await this.ensureBankAccount(companyId, id);
    await this.prisma.bankAccount.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  private async ensureBankAccount(companyId: string, id: string) {
    const row = await this.prisma.bankAccount.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Bank account not found');
    return row;
  }

  // ─── Bank Reconciliation ───
  async listStatementLines(companyId: string, bankAccountId: string) {
    await this.ensureBankAccount(companyId, bankAccountId);
    return this.prisma.bankStatementLine.findMany({
      where: { companyId, bankAccountId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async addStatementLine(companyId: string, bankAccountId: string, dto: BankStatementLineDto) {
    await this.ensureBankAccount(companyId, bankAccountId);
    return this.prisma.bankStatementLine.create({
      data: {
        companyId,
        bankAccountId,
        date: new Date(dto.date),
        description: dto.description.trim(),
        reference: dto.reference?.trim() || null,
        amount: dto.amount,
      },
    });
  }

  async toggleStatementReconciled(companyId: string, lineId: string) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, companyId },
    });
    if (!line) throw new NotFoundException('Statement line not found');
    const next = !line.isReconciled;
    return this.prisma.bankStatementLine.update({
      where: { id: lineId },
      data: {
        isReconciled: next,
        reconciledAt: next ? new Date() : null,
      },
    });
  }

  async deleteStatementLine(companyId: string, lineId: string) {
    const line = await this.prisma.bankStatementLine.findFirst({
      where: { id: lineId, companyId },
    });
    if (!line) throw new NotFoundException('Statement line not found');
    await this.prisma.bankStatementLine.delete({ where: { id: lineId } });
    return { message: 'Deleted' };
  }

  async getReconciliationReport(companyId: string, bankAccountId: string) {
    const bank = await this.ensureBankAccount(companyId, bankAccountId);
    const lines = await this.prisma.bankStatementLine.findMany({
      where: { companyId, bankAccountId },
      orderBy: { date: 'asc' },
    });

    const bookBalance = Number(bank.currentBalance);
    const statementBalance = lines.reduce((s, l) => s + Number(l.amount), Number(bank.openingBalance));
    const reconciledTotal = lines
      .filter((l) => l.isReconciled)
      .reduce((s, l) => s + Number(l.amount), 0);
    const unreconciled = lines.filter((l) => !l.isReconciled);
    const unreconciledTotal = unreconciled.reduce((s, l) => s + Number(l.amount), 0);

    return {
      bankAccount: {
        id: bank.id,
        name: bank.name,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        currency: bank.currency,
        openingBalance: Number(bank.openingBalance),
      },
      bookBalance,
      statementBalance: Number(statementBalance.toFixed(3)),
      difference: Number((statementBalance - bookBalance).toFixed(3)),
      reconciledCount: lines.filter((l) => l.isReconciled).length,
      unreconciledCount: unreconciled.length,
      reconciledTotal: Number(reconciledTotal.toFixed(3)),
      unreconciledTotal: Number(unreconciledTotal.toFixed(3)),
      lines,
    };
  }

  // ─── Payroll ───
  findPayrollRuns(companyId: string) {
    return this.prisma.payrollRun.findMany({
      where: { companyId },
      include: {
        branch: { select: { id: true, name: true } },
        lines: { include: { employee: { select: { id: true, name: true, employeeNumber: true } } } },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  async createPayrollRun(companyId: string, dto: CreatePayrollDto) {
    const employees = await this.prisma.employee.findMany({
      where: {
        companyId,
        isActive: true,
        ...(dto.branchId ? { branchId: dto.branchId } : {}),
      },
    });
    if (employees.length === 0) {
      throw new BadRequestException('No active employees for payroll');
    }

    const year = dto.periodYear;
    const prefix = `PAY-${year}-`;
    const latest = await this.prisma.payrollRun.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
    });
    let seq = 1;
    if (latest?.number) {
      const m = latest.number.match(/-(\d+)$/);
      if (m) seq = parseInt(m[1], 10) + 1;
    }
    const number = `${prefix}${String(seq).padStart(4, '0')}`;

    const lines = employees.map((e) => {
      const base = Number(e.baseSalary);
      return {
        employeeId: e.id,
        baseSalary: base,
        allowances: 0,
        deductions: 0,
        netSalary: base,
      };
    });
    const totalNet = lines.reduce((s, l) => s + l.netSalary, 0);

    return this.prisma.payrollRun.create({
      data: {
        companyId,
        branchId: dto.branchId,
        number,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
        notes: dto.notes,
        totalNet,
        lines: { create: lines },
      },
      include: {
        lines: { include: { employee: true } },
        branch: true,
      },
    });
  }

  async updatePayrollStatus(companyId: string, id: string, status: PayrollStatus) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id, companyId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    return this.prisma.payrollRun.update({
      where: { id },
      data: { status },
      include: { lines: { include: { employee: true } } },
    });
  }

  async deletePayrollRun(companyId: string, id: string) {
    const run = await this.prisma.payrollRun.findFirst({ where: { id, companyId } });
    if (!run) throw new NotFoundException('Payroll run not found');
    if (run.status === PayrollStatus.PAID) {
      throw new BadRequestException('Cannot delete paid payroll');
    }
    await this.prisma.payrollRun.delete({ where: { id } });
    return { message: 'Deleted' };
  }
}
