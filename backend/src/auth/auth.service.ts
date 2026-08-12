import { Injectable, UnauthorizedException, ForbiddenException, Logger, BadRequestException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';

import { PrismaService } from '../prisma/prisma.service';
import { AccountCategory, AccountType } from '@prisma/client';
import { ensureDefaultCostCentersAndProjects } from '../erp/default-analytics.seed';
import { ensureCompanyAppsLinked } from '../common/company-apps-link';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenPayload } from './interfaces/token-payload.interface';
import { decryptSecret, encryptSecret, hashToken } from '../common/crypto/secrets.crypto';
import { resolveModulePermissions } from '../common/module-permissions';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { AuditService } from '../audit/audit.service';
import { CompleteInviteDto } from './dto/invite.dto';
import {
  companyRequires2faForAdmins,
  computeTwoFactorGrace,
  envRequires2faForRole,
  isHard2faAfterGraceEnabled,
  parseRequire2faGraceDays,
  resolveTwoFactorGraceStart,
} from './two-factor-policy';
import { assertPublicRegistrationAllowed } from './registration-policy';
import { EmailNotifyService } from '../notifications/email-notify.service';
import { randomBytes } from 'crypto';
import { resolveCountryPack } from '../common/country-packs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private googleClient: OAuth2Client | null = null;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private audit: AuditService,
    private emailNotify: EmailNotifyService,
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
      include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
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

  async login(
    dto: LoginDto,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
    try {
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

      await this.auditAuth({
        companyId: user.companyId,
        userId: user.id,
        action: 'LOGIN_OK',
        email: user.email,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return this.issueSession(user, meta);
    } catch (err) {
      await this.auditFailedLogin(
        dto.email,
        meta.ipAddress,
        meta.userAgent,
        err,
      );
      throw err;
    }
  }

  async verify2faLogin(
    tempToken: string,
    code: string,
    meta: { ipAddress?: string; userAgent?: string } = {},
  ) {
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
      include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });
    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException(
        `Account locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    const secret = this.readTotpSecret(user.twoFactorSecret, user.id);
    if (!this.verifyTotp(secret, code)) {
      await this.incrementLoginAttempts(user.id);
      throw new UnauthorizedException('Invalid authentication code');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const { password: _, twoFactorSecret: __, ...safe } = user;
    return this.issueSession(safe, meta);
  }

  async get2faStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorEnabled: true,
        role: true,
        companyId: true,
        createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    const required = await this.isTwoFactorRequired(user);
    const grace = this.resolveTwoFactorGrace(required, !!user.twoFactorEnabled, user.createdAt);
    return {
      enabled: !!user.twoFactorEnabled,
      required,
      pastGrace: grace.pastGrace,
      deadline: grace.deadline,
      daysLeft: grace.daysLeft,
      hardAfterGrace: this.isHard2faAfterGrace(),
    };
  }

  /**
   * Wave H: 2FA required for listed roles.
   * Env REQUIRE_2FA_ROLES defaults to ADMIN,MANAGER.
   * Set REQUIRE_2FA_ROLES=off to disable env policy.
   * Company securityConfig.require2faForAdmins=true also forces ADMIN/MANAGER.
   */
  async isTwoFactorRequired(user: {
    role: string;
    companyId: string;
  }): Promise<boolean> {
    const envRaw =
      this.config.get<string>('REQUIRE_2FA_ROLES') ||
      process.env.REQUIRE_2FA_ROLES ||
      'ADMIN,MANAGER';
    if (envRequires2faForRole(user.role, envRaw)) return true;

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
      select: { securityConfig: true },
    });
    return companyRequires2faForAdmins(user.role, company?.securityConfig);
  }

  /** Wave BO — grace clock from REQUIRE_2FA_GRACE_FROM or user.createdAt. */
  resolveTwoFactorGrace(
    required: boolean,
    enabled: boolean,
    userCreatedAt: Date,
  ) {
    const graceDays = parseRequire2faGraceDays(
      this.config.get<string>('REQUIRE_2FA_GRACE_DAYS') ||
        process.env.REQUIRE_2FA_GRACE_DAYS,
    );
    const graceStart = resolveTwoFactorGraceStart(
      this.config.get<string>('REQUIRE_2FA_GRACE_FROM') ||
        process.env.REQUIRE_2FA_GRACE_FROM,
      userCreatedAt,
    );
    return computeTwoFactorGrace(required, enabled, graceDays, graceStart);
  }

  /** Wave CE — mutations blocked after grace only when env hard-lock is on. */
  isHard2faAfterGrace(): boolean {
    return isHard2faAfterGraceEnabled(
      this.config.get<string>('REQUIRE_2FA_HARD_AFTER_GRACE') ||
        process.env.REQUIRE_2FA_HARD_AFTER_GRACE,
    );
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
        twoFactorSecret: encryptSecret(secret, {
          purpose: 'totp',
          aad: `user:${userId}`,
        }),
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
    const secret = this.readTotpSecret(user.twoFactorSecret, user.id);
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
    if (await this.isTwoFactorRequired(user)) {
      throw new ForbiddenException(
        'Two-factor authentication is required for this role and cannot be disabled',
      );
    }
    if (!user.password) {
      throw new BadRequestException('Set a password before disabling 2FA on Google accounts');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid password');
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const secret = this.readTotpSecret(user.twoFactorSecret, user.id);
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

  private readTotpSecret(stored: string, userId: string): string {
    return decryptSecret(stored, {
      purpose: 'totp',
      aad: `user:${userId}`,
    });
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

    // Keep Accounting / POS / Resto unified — never block login on this
    if (user.companyId) {
      void ensureCompanyAppsLinked(this.prisma, user.companyId).catch(() => undefined);
    }

    const twoFactorRequired = await this.isTwoFactorRequired(user);
    const grace = this.resolveTwoFactorGrace(
      twoFactorRequired,
      !!user.twoFactorEnabled,
      user.createdAt instanceof Date
        ? user.createdAt
        : new Date(user.createdAt || Date.now()),
    );

    return {
      requires2fa: false as const,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username || null,
        phone: user.phone || null,
        role: user.role,
        avatar: user.avatar || null,
        companyId: user.companyId,
        company: this.enrichCompany(user.company),
        permissions: user.permissions || null,
        modulePermissions: resolveModulePermissions(user.role, user.permissions),
        defaultWarehouseId: user.defaultWarehouseId || null,
        defaultWarehouse: user.defaultWarehouse || null,
        twoFactorEnabled: !!user.twoFactorEnabled,
        twoFactorRequired,
        twoFactorPastGrace: grace.pastGrace,
        twoFactorDeadline: grace.deadline,
        twoFactorDaysLeft: grace.daysLeft,
        twoFactorHardAfterGrace: this.isHard2faAfterGrace(),
      },
      ...tokens,
    };
  }

  async register(dto: RegisterDto) {
    assertPublicRegistrationAllowed();
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ForbiddenException('Email already registered');
    }

    // Always start on STARTER — paid upgrades go through payment checkout only
    const countryPack = resolveCountryPack(dto.country);
    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        plan: 'STARTER',
        currency: countryPack.currency,
        language: dto.language || countryPack.language,
        country: countryPack.country,
        timezone: countryPack.timezone,
        posLinkedAt: new Date(),
        restoLinkedAt: new Date(),
      },
    });

    await this.createDefaultAccounts(company.id);
    await ensureDefaultCostCentersAndProjects(this.prisma, company.id);

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        password: hashedPassword,
        role: 'ADMIN',
        companyId: company.id,
      },
      include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });

    return this.issueSession(user, {});
  }

  async loginWithGoogle(
    idToken: string,
    companyName?: string,
    countryCode?: string,
  ) {
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
      include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });

    if (user) {
      if (!user.isActive) {
        throw new UnauthorizedException('Invalid credentials');
      }
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new ForbiddenException(`Account locked until ${user.lockedUntil.toISOString()}`);
      }

      const companyPatch: { email?: string; logo?: string } = {};
      if (!user.company?.email) companyPatch.email = email;
      if (!user.company?.logo && avatar) companyPatch.logo = avatar;
      if (Object.keys(companyPatch).length) {
        await this.prisma.company.update({
          where: { id: user.companyId },
          data: companyPatch,
        });
      }

      if (!user.googleId || user.avatar !== avatar || user.name !== name) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId,
            name: name || user.name,
            avatar: avatar || user.avatar,
            loginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
          include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
        });
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { loginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        user = await this.prisma.user.findUnique({
          where: { id: user.id },
          include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
        });
      }

      if (!user) throw new UnauthorizedException('Invalid credentials');

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

    assertPublicRegistrationAllowed();
    const countryPack = resolveCountryPack(countryCode);
    const company = await this.prisma.company.create({
      data: {
        name: (companyName || `شركة ${name}`).trim(),
        email,
        plan: 'STARTER',
        currency: countryPack.currency,
        language: countryPack.language,
        country: countryPack.country,
        timezone: countryPack.timezone,
        logo: avatar,
        posLinkedAt: new Date(),
        restoLinkedAt: new Date(),
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
      include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
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
        include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
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

  async requestPasswordReset(emailInput: string) {
    const email = String(emailInput || '').trim().toLowerCase();
    const user = email
      ? await this.prisma.user.findUnique({
          where: { email },
          select: { id: true, companyId: true, email: true, name: true, isActive: true },
        })
      : null;
    if (user?.isActive) {
      await this.issuePasswordReset(user);
    }
    // Deliberately identical for existing and unknown users.
    return {
      message: 'If the account exists, password reset instructions were sent.',
    };
  }

  async requestPasswordResetByUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, companyId: true, email: true, name: true, isActive: true },
    });
    if (!user || !user.isActive) throw new BadRequestException('User is not active');
    const delivery = await this.issuePasswordReset(user);
    return {
      ok: delivery.ok,
      email: user.email,
      emailSent: delivery.ok && !delivery.mock,
      emailMock: !!delivery.mock,
      ...(delivery.error ? { emailError: delivery.error } : {}),
    };
  }

  private async issuePasswordReset(user: {
    id: string;
    companyId: string;
    email: string;
    name: string;
  }) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      }),
    ]);

    const frontend = (
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN?.split(',')[0] ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
    // Fragment keeps the raw token out of reverse-proxy and access logs.
    const resetUrl = `${frontend}/reset-password#token=${encodeURIComponent(token)}`;
    const delivery = await this.emailNotify.sendText({
      to: user.email,
      subject: 'Hisaby — password reset / إعادة تعيين كلمة المرور',
      text: [
        `Hello ${user.name},`,
        'Use the following link within 15 minutes to reset your password:',
        resetUrl,
        '',
        `مرحباً ${user.name}،`,
        'استخدم الرابط التالي خلال 15 دقيقة لإعادة تعيين كلمة المرور:',
        resetUrl,
        '',
        'If you did not request this, ignore this message.',
      ].join('\n'),
    });
    await this.auditAuth({
      companyId: user.companyId,
      userId: user.id,
      action: 'PASSWORD_RESET_REQUEST',
      email: user.email,
    });
    return delivery;
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashToken(token);
    const reset = await this.prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, companyId: true, email: true, isActive: true } } },
    });
    if (!reset?.user?.isActive) {
      throw new UnauthorizedException('Invalid or expired password reset link');
    }
    const password = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.user.id },
        data: { password, loginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.session.deleteMany({ where: { userId: reset.user.id } }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: reset.user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    await this.auditAuth({
      companyId: reset.user.companyId,
      userId: reset.user.id,
      action: 'PASSWORD_RESET_COMPLETE',
      email: reset.user.email,
    });
    return { message: 'Password changed. Sign in again on all devices.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive || !user.password) {
      throw new UnauthorizedException('Current password is required');
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException('New password must differ from current password');
    }
    const password = await bcrypt.hash(newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password, loginAttempts: 0, lockedUntil: null },
      }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    await this.auditAuth({
      companyId: user.companyId,
      userId: user.id,
      action: 'PASSWORD_CHANGE',
      email: user.email,
    });
    return { message: 'Password changed. All sessions were revoked.' };
  }

  async getInvite(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { inviteToken: token, isActive: true },
      include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });
    if (!user || !user.mustCompleteProfile) {
      throw new UnauthorizedException('Invalid invitation');
    }
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      throw new UnauthorizedException('Invitation expired');
    }
    return {
      name: user.name,
      email: user.email,
      username: user.username || null,
      phone: user.phone || null,
      role: user.role,
      company: this.enrichCompany(user.company),
      defaultWarehouseId: user.defaultWarehouseId || null,
      defaultWarehouse: user.defaultWarehouse || null,
    };
  }

  async completeInvite(dto: CompleteInviteDto) {
    const user = await this.prisma.user.findFirst({
      where: { inviteToken: dto.token, isActive: true },
      include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });
    if (!user || !user.mustCompleteProfile) {
      throw new UnauthorizedException('Invalid invitation');
    }
    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      throw new UnauthorizedException('Invitation expired');
    }
    const username = dto.username?.trim().toLowerCase() || user.username || null;
    if (username) {
      const exists = await this.prisma.user.findFirst({
        where: { username, id: { not: user.id } },
        select: { id: true },
      });
      if (exists) throw new BadRequestException('Username already exists');
    }
    const hashed = await bcrypt.hash(dto.password, 12);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        name: dto.name?.trim() || user.name,
        phone: dto.phone?.trim() || user.phone,
        username,
        inviteAcceptedAt: new Date(),
        inviteToken: null,
        inviteExpiresAt: null,
        mustCompleteProfile: false,
      },
      include: {
        company: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });
    await this.auditAuth({
      companyId: updated.companyId,
      userId: updated.id,
      action: 'INVITE_ACCEPT',
      email: updated.email,
    });
    return this.issueSession(updated, {});
  }

  async getProfile(userId: string) {
    if (userId.startsWith('api-key:')) {
      throw new UnauthorizedException('API keys cannot use /auth/me');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            crNumber: true,
            vatNumber: true,
            address: true,
            city: true,
            country: true,
            phone: true,
            email: true,
            website: true,
            plan: true,
            planExpiry: true,
            planStartedAt: true,
            isActive: true,
            timezone: true,
            currency: true,
            language: true,
            fiscalYearStart: true,
            ftaConfig: true,
            posWarehouseId: true,
            restoWarehouseId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    const { password: _, ...safe } = user;
    const twoFactorRequired = await this.isTwoFactorRequired(safe);
    const grace = this.resolveTwoFactorGrace(
      twoFactorRequired,
      !!safe.twoFactorEnabled,
      safe.createdAt,
    );
    return {
      id: safe.id,
      name: safe.name,
      email: safe.email,
      username: safe.username || null,
      phone: safe.phone || null,
      role: safe.role,
      avatar: safe.avatar || null,
      companyId: safe.companyId,
      company: this.enrichCompany(safe.company),
      twoFactorEnabled: !!safe.twoFactorEnabled,
      twoFactorRequired,
      twoFactorPastGrace: grace.pastGrace,
      twoFactorDeadline: grace.deadline,
      twoFactorDaysLeft: grace.daysLeft,
      twoFactorHardAfterGrace: this.isHard2faAfterGrace(),
      permissions: safe.permissions || null,
      modulePermissions: resolveModulePermissions(safe.role, safe.permissions),
      defaultWarehouseId: safe.defaultWarehouseId || null,
      defaultWarehouse: safe.defaultWarehouse || null,
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
        expiresIn: this.config.get<string>(
          'jwt.expiration',
        ) as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>(
          'jwt.refreshExpiration',
        ) as JwtSignOptions['expiresIn'],
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
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil },
      });
      await this.auditAuth({
        companyId: user.companyId,
        userId: user.id,
        action: 'ACCOUNT_LOCK',
        email: user.email,
        details: { lockedUntil: lockedUntil.toISOString() },
      });
    }
  }

  private async auditFailedLogin(
    email: string,
    ipAddress?: string,
    userAgent?: string,
    err?: unknown,
  ) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!normalized) return;
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, companyId: true, email: true },
    });
    if (!user) return;
    const locked = this.exceptionLooksLocked(err);
    await this.auditAuth({
      companyId: user.companyId,
      userId: user.id,
      action: locked ? 'ACCOUNT_LOCK' : 'LOGIN_FAIL',
      email: user.email,
      ipAddress,
      userAgent,
    });
  }

  private exceptionLooksLocked(err: unknown): boolean {
    if (!(err instanceof ForbiddenException)) return false;
    const res = err.getResponse();
    const text =
      typeof res === 'string'
        ? res
        : res && typeof res === 'object' && 'message' in res
          ? Array.isArray((res as { message: unknown }).message)
            ? ((res as { message: string[] }).message).join(' ')
            : String((res as { message: unknown }).message || '')
          : String(err.message || '');
    return text.toLowerCase().includes('locked');
  }

  private async auditAuth(opts: {
    companyId: string;
    userId?: string;
    action: string;
    email?: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  }) {
    await this.audit.log({
      companyId: opts.companyId,
      userId: opts.userId || null,
      action: opts.action,
      entity: 'Auth',
      entityId: opts.userId || null,
      newValues: {
        email: opts.email,
        ...(opts.details || {}),
      },
      ipAddress: opts.ipAddress || null,
      userAgent: opts.userAgent || null,
    });
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
      { code: '2130', name: 'ائتمان عملاء (رصيد متجر)', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
      { code: '2150', name: 'رواتب مستحقة', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
      { code: '2160', name: 'مطالبات موظفين مستحقة', type: 'LIABILITY', category: 'CURRENT_LIABILITY' },
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
      { code: '5210', name: 'مصروف الرواتب', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
      { code: '5220', name: 'مصروف مطالبات الموظفين', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
      { code: '5300', name: 'مصروف الإهلاك', type: 'EXPENSE', category: 'OPERATING_EXPENSE' },
      { code: '5400', name: 'خسائر فروق عملة غير محققة', type: 'EXPENSE', category: 'OTHER_EXPENSE' },
    ];

    await this.prisma.account.createMany({
      data: defaultAccounts.map((acc) => ({ ...acc, companyId })),
    });
  }
}
