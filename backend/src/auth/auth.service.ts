import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { AccountCategory, AccountType } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenPayload } from './interfaces/token-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { company: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(`Account locked until ${user.lockedUntil}`);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await this.incrementLoginAttempts(user.id);
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const { password: _, ...result } = user;
    return result;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    const tokens = await this.generateTokens(user);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: tokens.accessToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company,
      },
      ...tokens,
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ForbiddenException('Email already registered');
    }

    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        plan: dto.plan as any,
        currency: 'OMR',
        language: 'ar',
        country: 'OM',
        timezone: 'Asia/Muscat',
      },
    });

    await this.createDefaultAccounts(company.id);

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashedPassword,
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    const tokens = await this.generateTokens({ ...user, company });

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, company },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { company: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException();
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, token: string) {
    await this.prisma.session.deleteMany({
      where: { userId, token },
    });
    return { message: 'Logged out successfully' };
  }

  private async generateTokens(user: any) {
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiration'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiration'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async incrementLoginAttempts(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { loginAttempts: { increment: 1 } },
    });

    if (user.loginAttempts >= 5) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + 30 * 60 * 1000) },
      });
    }
  }

  private async createDefaultAccounts(companyId: string) {
    const defaultAccounts: Array<{
      code: string;
      name: string;
      type: AccountType;
      category: AccountCategory;
      isBank?: boolean;
    }> = [
      { code: '1000', name: 'الأصول', type: 'ASSET', category: 'CURRENT_ASSET' },
      { code: '1100', name: 'الصندوق', type: 'ASSET', category: 'CURRENT_ASSET', isBank: false },
      { code: '1200', name: 'البنك', type: 'ASSET', category: 'CURRENT_ASSET', isBank: true },
      { code: '1300', name: 'العملاء', type: 'ASSET', category: 'CURRENT_ASSET' },
      { code: '1400', name: 'المخزون', type: 'ASSET', category: 'CURRENT_ASSET' },
      { code: '2000', name: 'الخصوم', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
      { code: '2100', name: 'الموردين', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
      { code: '2200', name: 'ضريبة القيمة المضافة', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
      { code: '3000', name: 'حقوق الملكية', type: 'EQUITY', category: 'EQUITY' },
      { code: '3100', name: 'رأس المال', type: 'EQUITY', category: 'EQUITY' },
      { code: '3200', name: 'الأرباح المحتجزة', type: 'EQUITY', category: 'EQUITY' },
      { code: '4000', name: 'الإيرادات', type: 'REVENUE', category: 'REVENUE' },
      { code: '4100', name: 'مبيعات', type: 'REVENUE', category: 'REVENUE' },
      { code: '5000', name: 'المصروفات', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
      { code: '5100', name: 'تكلفة البضاعة المباعة', type: 'EXPENSE', category: 'COST_OF_SALES' },
      { code: '5200', name: 'مصروفات تشغيلية', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
    ];

    await this.prisma.account.createMany({
      data: defaultAccounts.map(acc => ({ ...acc, companyId })),
    });
  }
}
