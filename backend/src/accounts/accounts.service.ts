import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto, UpdateAccountDto } from './dto/account.dto';

export interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  type: string;
  category: string;
  parentId?: string | null;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  isBank: boolean;
  children: AccountTreeNode[];
}

@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.account.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
      include: { parent: { select: { id: true, code: true, name: true } } },
    });
  }

  async findTree(companyId: string): Promise<AccountTreeNode[]> {
    const rows = await this.prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const map = new Map<string, AccountTreeNode>();
    for (const row of rows) {
      map.set(row.id, {
        id: row.id,
        code: row.code,
        name: row.name,
        nameEn: row.nameEn,
        type: row.type,
        category: row.category,
        parentId: row.parentId,
        openingBalance: Number(row.openingBalance),
        currentBalance: Number(row.currentBalance),
        isActive: row.isActive,
        isBank: row.isBank,
        children: [],
      });
    }

    const roots: AccountTreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async findOne(companyId: string, id: string) {
    const account = await this.prisma.account.findFirst({
      where: { id, companyId },
      include: {
        parent: { select: { id: true, code: true, name: true } },
        children: { select: { id: true, code: true, name: true } },
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async create(companyId: string, dto: CreateAccountDto) {
    const exists = await this.prisma.account.findFirst({
      where: { companyId, code: dto.code },
    });
    if (exists) throw new ConflictException('Account code already exists');

    if (dto.parentId) {
      await this.findOne(companyId, dto.parentId);
    }

    const opening = dto.openingBalance ?? 0;
    return this.prisma.account.create({
      data: {
        companyId,
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        type: dto.type,
        category: dto.category,
        parentId: dto.parentId || null,
        openingBalance: opening,
        currentBalance: opening,
        isBank: dto.isBank ?? false,
        bankName: dto.bankName,
        bankAccount: dto.bankAccount,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateAccountDto) {
    await this.findOne(companyId, id);

    if (dto.code) {
      const dup = await this.prisma.account.findFirst({
        where: { companyId, code: dto.code, NOT: { id } },
      });
      if (dup) throw new ConflictException('Account code already exists');
    }

    if (dto.parentId === id) {
      throw new BadRequestException('Account cannot be its own parent');
    }

    if (dto.parentId) {
      await this.findOne(companyId, dto.parentId);
    }

    const data: Record<string, unknown> = { ...dto };
    if (dto.openingBalance != null) {
      data.currentBalance = dto.openingBalance;
    }

    return this.prisma.account.update({
      where: { id },
      data,
    });
  }

  async remove(companyId: string, id: string) {
    const account = await this.findOne(companyId, id);
    const childCount = await this.prisma.account.count({ where: { parentId: id } });
    if (childCount > 0) {
      throw new BadRequestException('Cannot delete account with sub-accounts');
    }
    const lineCount = await this.prisma.journalLine.count({ where: { accountId: id } });
    if (lineCount > 0) {
      throw new BadRequestException('Cannot delete account used in journal entries');
    }
    await this.prisma.account.delete({ where: { id: account.id } });
    return { message: 'Account deleted' };
  }
}
