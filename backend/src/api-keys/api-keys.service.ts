import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';

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
        lastUsedAt: true,
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

    const row = await this.prisma.companyApiKey.create({
      data: {
        companyId,
        name: dto.name.trim(),
        keyPrefix,
        keyHash,
        createdById: userId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
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
    if (!dto.name?.trim()) {
      throw new BadRequestException('Name is required');
    }

    return this.prisma.companyApiKey.update({
      where: { id },
      data: { name: dto.name.trim() },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
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
  async validateSecret(secret: string): Promise<TokenPayload | null> {
    if (!secret?.startsWith('qk_')) return null;
    const keyHash = this.hashKey(secret);
    const row = await this.prisma.companyApiKey.findFirst({
      where: { keyHash, revokedAt: null },
      include: {
        company: { select: { id: true, isActive: true } },
      },
    });
    if (!row || !row.company.isActive) return null;

    await this.prisma.companyApiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      sub: row.createdById || `api-key:${row.id}`,
      email: `api-key@${row.companyId}.local`,
      role: 'ACCOUNTANT',
      companyId: row.companyId,
    };
  }
}
