import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { MODULE_KEYS, ModulePermissions } from '../common/module-permissions';

const ALLOWED_SCOPE_SET = new Set([
  'read',
  'write',
  'all:modules',
  ...MODULE_KEYS.map((key) => `module:${key}`),
]);

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  private hashKey(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private generateSecret() {
    const body = randomBytes(24).toString('hex');
    return `qk_live_${body}`;
  }

  findAll(companyId: string) {
    return this.prisma.companyApiKey.findMany({
      where: { companyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
        revokedAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, userId: string, dto: CreateApiKeyDto) {
    const secret = this.generateSecret();
    const keyPrefix = secret.slice(0, 16);
    const keyHash = this.hashKey(secret);
    const scopes = this.validateScopes(dto.scopes || ['read', 'all:modules']);
    const expiresAt = this.validateExpiry(dto.expiresAt);

    const row = await this.prisma.companyApiKey.create({
      data: {
        companyId,
        name: dto.name.trim(),
        keyPrefix,
        keyHash,
        scopes,
        expiresAt,
        createdById: userId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      ...row,
      secret,
      warning: 'Store this key now — it will not be shown again',
    };
  }

  async update(companyId: string, id: string, dto: UpdateApiKeyDto) {
    const existing = await this.prisma.companyApiKey.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('API key not found');
    if (existing.revokedAt) {
      throw new BadRequestException('Cannot rename a revoked key');
    }
    const name = dto.name?.trim() || existing.name;
    const scopes = dto.scopes
      ? this.validateScopes(dto.scopes)
      : (existing.scopes as string[]);
    const expiresAt =
      dto.expiresAt !== undefined
        ? this.validateExpiry(dto.expiresAt)
        : existing.expiresAt;

    return this.prisma.companyApiKey.update({
      where: { id },
      data: { name, scopes, expiresAt },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async revoke(companyId: string, id: string) {
    const existing = await this.prisma.companyApiKey.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('API key not found');
    if (existing.revokedAt) {
      throw new BadRequestException('API key already revoked');
    }

    return this.prisma.companyApiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        revokedAt: true,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const existing = await this.prisma.companyApiKey.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('API key not found');
    await this.prisma.companyApiKey.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  /** Validate raw secret and return a TokenPayload-compatible user for guards */
  async validateSecret(secret: string, ipAddress?: string): Promise<TokenPayload | null> {
    if (!secret?.startsWith('qk_')) return null;
    const keyHash = this.hashKey(secret);
    const row = await this.prisma.companyApiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        company: { select: { id: true, isActive: true } },
      },
    });
    if (!row || !row.company.isActive) return null;

    await this.prisma.companyApiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date(), lastUsedIp: ipAddress || null },
    });

    const scopes = this.validateStoredScopes(row.scopes);
    const access = scopes.includes('write') ? 'edit' : 'view';
    const allModules = scopes.includes('all:modules');
    const modulePermissions = Object.fromEntries(
      MODULE_KEYS.map((module) => [
        module,
        allModules || scopes.includes(`module:${module}`) ? access : 'hidden',
      ]),
    ) as ModulePermissions;

    return {
      sub: row.createdById || `api-key:${row.id}`,
      email: `api-key@${row.companyId}.local`,
      role: 'ACCOUNTANT',
      companyId: row.companyId,
      modulePermissions,
      apiKeyScopes: scopes,
    };
  }

  private validateStoredScopes(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (scope): scope is string =>
        typeof scope === 'string' && ALLOWED_SCOPE_SET.has(scope),
    );
  }

  private validateScopes(scopes: string[]): string[] {
    const normalized = [...new Set(scopes.map((scope) => scope.trim()))];
    if (!normalized.length || !normalized.includes('read')) {
      throw new BadRequestException('API key scopes must include read');
    }
    const invalid = normalized.find((scope) => !ALLOWED_SCOPE_SET.has(scope));
    if (invalid) throw new BadRequestException(`Invalid API key scope: ${invalid}`);
    return normalized;
  }

  private validateExpiry(value?: string): Date | null {
    if (!value) return null;
    const date = new Date(value);
    const max = Date.now() + 366 * 24 * 60 * 60 * 1000;
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new BadRequestException('API key expiry must be in the future');
    }
    if (date.getTime() > max) {
      throw new BadRequestException('API key expiry cannot exceed 366 days');
    }
    return date;
  }
}
