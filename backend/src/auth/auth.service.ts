import { Injectable, UnauthorizedException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';

import { PrismaService } from '../prisma/prisma.service';
import { AccountCategory, AccountType, Plan } from '@prisma/client';
import { ensureDefaultCostCentersAndProjects } from '../erp/default-analytics.seed';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenPayload } from './interfaces/token-payload.interface';
import { decryptSecret, encryptSecret, hashToken } from '../common/crypto/secrets.crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  private getGoogleClient() {
    const clientId = this.config.get<string>('google.clientId') || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(clientId);
    }
    return { client: this.googleClient, clientId };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { company: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(`Account locked until ${user.lockedUntil.toISOString()}`);
    }

    if (!user.password) {
      throw new UnauthorizedException('This account uses Google sign-in');
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

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = await this.jwtService.signAsync(
        { sub: user.id, purpose: '2fa' },
        {
          secret: this.config.get<string>('jwt.secret'),
          expiresIn: '5m',
        },
      );
      return { requires2fa: true as const, tempToken };
    }

    return this.issueSession(user, {
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });
  }

  async verify2faLogin(tempToken: string, code: string) {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(tempToken, {
        secret: this.config.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA session');
    }
    if (payload.purpose !== '2fa' || !payload.sub) {
      throw new UnauthorizedException('Invalid 2FA session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { company: true },
    });
    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const secret = this.readTotpSecret(user.twoFactorSecret);
    if (!this.verifyTotp(secret, code)) {
      await this.incrementLoginAttempts(user.id);
      throw new UnauthorizedException('Invalid authentication code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const { password: _, twoFactorSecret: __, ...safe } = user;
    return this.issueSession(safe, {});
  }

  async get2faStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return { enabled: !!user?.twoFactorEnabled };
  }

  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.twoFactorEnabled) {
      throw new ForbiddenException('2FA is already enabled — disable it first to reset');
    }

    const secret = generateSecret();
    const otpauthUrl = generateURI({
      issuer: 'BHD Pro',
      label: user.email,
      secret,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptSecret(secret),
        twoFactorEnabled: false,
      },
    });

    return { otpauthUrl, qrCodeDataUrl, secret };
  }

  async confirm2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Run 2FA setup first');
    }
    const secret = this.readTotpSecret(user.twoFactorSecret);
    if (!this.verifyTotp(secret, code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return { enabled: true };
  }

  async disable2fa(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!user.password) {
      throw new BadRequestException('Set a password before disabling 2FA on Google accounts');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid password');
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const secret = this.readTotpSecret(user.twoFactorSecret);
      if (!this.verifyTotp(secret, code)) {
        throw new UnauthorizedException('Invalid authentication code');
      }
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { enabled: false };
  }

  private readTotpSecret(stored: string): string {
    return decryptSecret(stored);
  }

  private verifyTotp(secret: string, code: string): boolean {
    const result = verifySync({ secret, token: code.replace(/\s/g, '') });
    return !!(result && typeof result === 'object' && 'valid' in result && result.valid);
  }

  private async issueSession(
    user: any,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const tokens = await this.generateTokens(user);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return {
      requires2fa: false as const,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: this.enrichCompany(user.company),
      },
      ...tokens,
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ForbiddenException('Email already registered');
    }

    // Always start on STARTER — paid upgrades go through payment checkout only
    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        plan: Plan.STARTER,
        currency: 'OMR',
        language: 'ar',
        country: 'OM',
        timezone: 'Asia/Muscat',
      },
    });

    await this.createDefaultAccounts(company.id);
    await ensureDefaultCostCentersAndProjects(this.prisma, company.id);

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

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: this.enrichCompany(company),
      },
      ...tokens,
    };
  }

  async loginWithGoogle(idToken: string, companyName?: string) {
    const { client, clientId } = this.getGoogleClient();
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch (err) {
      this.logger.warn(`Google token verification failed: ${err}`);
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.email || !payload.sub || payload.email_verified === false) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    const email = payload.email.trim().toLowerCase();
    const googleId = payload.sub;
    const name = (payload.name || email.split('@')[0]).trim();
    const avatar = payload.picture || null;

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
      include: { company: true },
    });

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new ForbiddenException(`Account locked until ${user.lockedUntil.toISOString()}`);
      }

      if (!user.googleId || user.avatar !== avatar) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            avatar: avatar || user.avatar,
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
          include: { company: true },
        });
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
      }

      if (user.twoFactorEnabled && user.twoFactorSecret) {
        const tempToken = await this.jwtService.signAsync(
          { sub: user.id, purpose: '2fa' },
          {
            secret: this.config.get<string>('jwt.secret'),
            expiresIn: '5m',
          },
        );
        return { requires2fa: true as const, tempToken };
      }

      const { password: _, twoFactorSecret: __, ...safe } = user;
      return this.issueSession(safe, {});
    }

    const company = await this.prisma.company.create({
      data: {
        name: (companyName || `شركة ${name}`).trim(),
        plan: Plan.STARTER,
        currency: 'OMR',
        language: 'ar',
        country: 'OM',
        timezone: 'Asia/Muscat',
      },
    });

    await this.createDefaultAccounts(company.id);
    await ensureDefaultCostCentersAndProjects(this.prisma, company.id);

    user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: null,
        googleId,
        avatar,
        role: 'ADMIN',
        companyId: company.id,
        lastLoginAt: new Date(),
      },
      include: { company: true },
    });

    const { password: _, twoFactorSecret: __, ...safe } = user;
    return this.issueSession(safe, {});
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });

      const tokenHash = hashToken(refreshToken);
      const session = await this.prisma.session.findFirst({
        where: {
          userId: payload.sub,
          token: tokenHash,
          expiresAt: { gt: new Date() },
        },
      });
      if (!session) {
        throw new UnauthorizedException('Session revoked or expired');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { company: true },
      });

      if (!user || !user.isActive || !user.company?.isActive) {
        throw new UnauthorizedException();
      }

      const tokens = await this.generateTokens(user);

      // Rotate refresh token — invalidate previous session row
      await this.prisma.$transaction([
        this.prisma.session.delete({ where: { id: session.id } }),
        this.prisma.session.create({
          data: {
            userId: user.id,
            token: hashToken(tokens.refreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          },
        }),
      ]);

      return tokens;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, _accessToken?: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    if (userId.startsWith('api-key:')) {
      throw new UnauthorizedException('API keys cannot use /auth/me');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    const { password: _, ...safe } = user;
    return {
      id: safe.id,
      name: safe.name,
      email: safe.email,
      role: safe.role,
      companyId: safe.companyId,
      company: this.enrichCompany(safe.company),
      twoFactorEnabled: !!safe.twoFactorEnabled,
    };
  }

  private enrichCompany<T extends { ftaConfig?: unknown } | null>(company: T) {
    if (!company) return company;
    const tax = (company.ftaConfig as {
      applyVat?: boolean;
      pricesIncludeTax?: boolean;
      vatRate?: number;
      signatureMode?: string;
      documentColor?: string;
    } | null) || {};

    let documentColor = '#059669';
    if (typeof tax.documentColor === 'string') {
      let c = tax.documentColor.trim();
      if (!c.startsWith('#')) c = `#${c}`;
      if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
        c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
      }
      if (/^#[0-9A-Fa-f]{6}$/.test(c)) documentColor = c.toUpperCase();
    }

    return {
      ...company,
      applyVat: tax.applyVat !== false,
      pricesIncludeTax: !!tax.pricesIncludeTax,
      vatRate: typeof tax.vatRate === 'number' ? tax.vatRate : 5,
      signatureMode: tax.signatureMode === 'ELECTRONIC' ? 'ELECTRONIC' : 'MANUAL',
      documentColor,
    };
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
      { code: '1500', name: 'الأصول الثابتة', type: 'ASSET', category: 'FIXED_ASSET' },
      { code: '1510', name: 'مجمع الإهلاك', type: 'ASSET', category: 'FIXED_ASSET' },
      { code: '2000', name: 'الخصوم', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
      { code: '2100', name: 'الموردين', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
      { code: '2200', name: 'ضريبة القيمة المضافة', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
      { code: '3000', name: 'حقوق الملكية', type: 'EQUITY', category: 'EQUITY' },
      { code: '3100', name: 'رأس المال', type: 'EQUITY', category: 'EQUITY' },
      { code: '3200', name: 'الأرباح المحتجزة', type: 'EQUITY', category: 'EQUITY' },
      { code: '4000', name: 'الإيرادات', type: 'REVENUE', category: 'REVENUE' },
      { code: '4100', name: 'مبيعات', type: 'REVENUE', category: 'REVENUE' },
      { code: '4200', name: 'أرباح فروق عملة غير محققة', type: 'REVENUE', category: 'OTHER_INCOME' },
      { code: '5000', name: 'المصروفات', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
      { code: '5100', name: 'تكلفة البضاعة المباعة', type: 'EXPENSE', category: 'COST_OF_SALES' },
      { code: '5200', name: 'مصروفات تشغيلية', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
      { code: '5300', name: 'مصروف الإهلاك', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
      { code: '5400', name: 'خسائر فروق عملة غير محققة', type: 'EXPENSE', category: 'OTHER_EXPENSE' },
    ];

    await this.prisma.account.createMany({
      data: defaultAccounts.map((acc) => ({ ...acc, companyId })),
    });
  }
}
