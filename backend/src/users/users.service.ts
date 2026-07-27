import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  MODULE_KEYS,
  resolveModulePermissions,
} from '../common/module-permissions';
import { EmailNotifyService } from '../notifications/email-notify.service';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private subscriptions: SubscriptionsService,
    private email: EmailNotifyService,
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
        username: true,
        phone: true,
        role: true,
        isActive: true,
        permissions: true,
        lastLoginAt: true,
        createdAt: true,
        mustCompleteProfile: true,
        inviteExpiresAt: true,
        inviteAcceptedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((u) => ({
      ...u,
      inviteStatus: !u.inviteAcceptedAt && u.mustCompleteProfile ? 'pending' : u.isActive ? 'active' : 'inactive',
      modulePermissions: resolveModulePermissions(u.role, u.permissions),
    }));
  }

  private async nextUsername(companyId: string) {
    const prefix = `u${companyId.replace(/-/g, '').slice(0, 4)}`;
    for (let i = 0; i < 100; i++) {
      const candidate = `${prefix}${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 9_999)
        .toString()
        .padStart(4, '0')}`;
      const exists = await this.prisma.user.findFirst({
        where: { username: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }
    throw new ConflictException('Could not generate username');
  }

  private inviteUrl(token: string) {
    const appUrl =
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    return `${appUrl.replace(/\/$/, '')}/complete-profile?invite=${encodeURIComponent(token)}`;
  }

  private async sendInviteEmail(args: {
    to: string;
    name: string;
    companyName: string;
    inviteUrl: string;
    username: string;
  }) {
    const subject = `دعوة حسابي — أكمل تفعيل حسابك`;
    const text = [
      `مرحباً ${args.name}،`,
      ``,
      `تمت إضافتك إلى شركة «${args.companyName}» في نظام حسابي.`,
      `اسم المستخدم المبدئي: ${args.username}`,
      `لإكمال التفعيل، افتح الرابط التالي وحدد كلمة المرور وبياناتك:`,
      args.inviteUrl,
      ``,
      `إذا لم تكن تتوقع هذه الدعوة، تجاهل هذه الرسالة.`,
      `— Hisaby`,
    ].join('\n');
    const html = `
      <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
        <h2>دعوة إلى حسابي</h2>
        <p>مرحباً ${args.name}،</p>
        <p>تمت إضافتك إلى شركة <strong>${args.companyName}</strong>.</p>
        <p>اسم المستخدم المبدئي: <strong>${args.username}</strong></p>
        <p><a href="${args.inviteUrl}">اضغط هنا لإكمال التفعيل</a></p>
      </div>
    `;
    return this.email.sendText({
      to: args.to,
      subject,
      text,
      html,
    });
  }

  async create(companyId: string, dto: CreateUserDto) {
    await this.subscriptions.assertCanCreateUser(companyId);
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const permissions = this.sanitizePermissions(dto.permissions);
    const inviteToken = randomBytes(24).toString('hex');
    const username = await this.nextUsername(companyId);
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.trim().toLowerCase(),
        username,
        role: dto.role,
        companyId,
        inviteToken,
        inviteExpiresAt,
        mustCompleteProfile: true,
        isActive: true,
        ...(permissions !== undefined ? { permissions } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        permissions: true,
        inviteExpiresAt: true,
        mustCompleteProfile: true,
      },
    });
    const inviteUrl = this.inviteUrl(inviteToken);
    await this.sendInviteEmail({
      to: user.email,
      name: user.name,
      companyName: company?.name || 'Hisaby',
      inviteUrl,
      username,
    });
    return {
      ...user,
      inviteUrl,
      inviteStatus: 'pending',
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
        username: true,
        phone: true,
        role: true,
        isActive: true,
        permissions: true,
        inviteExpiresAt: true,
        inviteAcceptedAt: true,
        mustCompleteProfile: true,
      },
    });
    return {
      ...updated,
      inviteStatus:
        !updated.inviteAcceptedAt && updated.mustCompleteProfile
          ? 'pending'
          : updated.isActive
            ? 'active'
            : 'inactive',
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

  async resendInvite(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      include: { company: { select: { name: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    const inviteToken = randomBytes(24).toString('hex');
    const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        inviteToken,
        inviteExpiresAt,
        inviteAcceptedAt: null,
        mustCompleteProfile: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        permissions: true,
        inviteExpiresAt: true,
        mustCompleteProfile: true,
      },
    });
    const inviteUrl = this.inviteUrl(inviteToken);
    await this.sendInviteEmail({
      to: updated.email,
      name: updated.name,
      companyName: user.company.name,
      inviteUrl,
      username: updated.username || (await this.nextUsername(companyId)),
    });
    return {
      ...updated,
      inviteUrl,
      inviteStatus: 'pending',
      modulePermissions: resolveModulePermissions(updated.role, updated.permissions),
    };
  }
}
