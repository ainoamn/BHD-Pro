import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  MODULE_KEYS,
  resolveModulePermissions,
} from '../common/module-permissions';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
  ) {}

  private sanitizePermissions(
    raw?: Record<string, string> | null,
  ): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
    if (raw === undefined) return undefined;
    if (raw === null) return Prisma.JsonNull;
    const next: Record<string, string> = {};
    for (const key of MODULE_KEYS) {
      const v = raw[key];
      if (v === 'hidden' || v === 'view' || v === 'edit') next[key] = v;
    }
    return next;
  }

  async findAll(companyId: string) {
    const rows = await this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((u) => ({
      ...u,
      modulePermissions: resolveModulePermissions(u.role, u.permissions),
    }));
  }

  async create(companyId: string, dto: CreateUserDto) {
    await this.subscriptions.assertCanCreateUser(companyId);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const hashed = await bcrypt.hash(dto.password, 12);
    const permissions = this.sanitizePermissions(dto.permissions);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: dto.role,
        companyId,
        ...(permissions !== undefined ? { permissions } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
      },
    });
    return {
      ...user,
      modulePermissions: resolveModulePermissions(user.role, user.permissions),
    };
  }

  async update(companyId: string, id: string, dto: UpdateUserDto, requesterId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('User not found');
    if (id === requesterId && dto.isActive === false) {
      throw new ForbiddenException('Cannot deactivate yourself');
    }

    const permissions = this.sanitizePermissions(dto.permissions);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(permissions !== undefined && { permissions }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        permissions: true,
      },
    });
    return {
      ...updated,
      modulePermissions: resolveModulePermissions(updated.role, updated.permissions),
    };
  }

  async remove(companyId: string, id: string, requesterId: string) {
    if (id === requesterId) throw new ForbiddenException('Cannot delete yourself');
    const user = await this.prisma.user.findFirst({ where: { id, companyId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({ where: { id }, data: { isActive: false } });
  }

  moduleCatalog() {
    return {
      modules: MODULE_KEYS,
      levels: ['hidden', 'view', 'edit'] as const,
    };
  }
}
