import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  DualApprovalDto,
  DualControlAction,
  DualControlActionsDto,
  UpdateSecurityConfigDto,
} from './dto/approval.dto';

export type CompanySecurityConfig = {
  dualControlEnabled?: boolean;
  supervisorPinHash?: string | null;
  /** Enabled methods. OTP / NFC reserved for a later phase. */
  methods?: Array<'SELF_CONFIRM' | 'PASSWORD' | 'PIN' | 'WHATSAPP_OTP' | 'NFC'>;
  actions?: DualControlActionsDto;
};

export type DualControlActor = {
  sub: string;
  role: string;
  email: string;
};

const APPROVER_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];
const DEFAULT_METHODS = ['SELF_CONFIRM', 'PASSWORD', 'PIN'] as const;

@Injectable()
export class DualControlService {
  constructor(private prisma: PrismaService) {}

  private parseConfig(raw: Prisma.JsonValue | null | undefined): CompanySecurityConfig {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as CompanySecurityConfig;
  }

  private async loadConfig(companyId: string): Promise<CompanySecurityConfig> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { securityConfig: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return this.parseConfig(company.securityConfig);
  }

  /** Secure-by-default: null/missing config enables dual control for all known actions. */
  async isRequired(companyId: string, action: DualControlAction): Promise<boolean> {
    const config = await this.loadConfig(companyId);
    if (config.dualControlEnabled === false) return false;
    const flag = config.actions?.[action];
    return flag !== false;
  }

  getPublicConfigFromRaw(raw: Prisma.JsonValue | null | undefined) {
    const config = this.parseConfig(raw);
    const dualControlEnabled = config.dualControlEnabled !== false;
    const actions = {
      POS_VOID: config.actions?.POS_VOID !== false,
      POS_PRICE_OVERRIDE: config.actions?.POS_PRICE_OVERRIDE !== false,
      STOCK_ADJUST: config.actions?.STOCK_ADJUST !== false,
      STOCK_TRANSFER: config.actions?.STOCK_TRANSFER !== false,
      INVOICE_CANCEL: config.actions?.INVOICE_CANCEL !== false,
      PAYMENT_REVERSE: config.actions?.PAYMENT_REVERSE !== false,
    };
    return {
      dualControlEnabled,
      hasSupervisorPin: !!config.supervisorPinHash,
      methods: [...DEFAULT_METHODS],
      /** Future: WhatsApp OTP, NFC badge — not implemented in this MVP. */
      futureMethods: ['WHATSAPP_OTP', 'NFC'] as const,
      actions,
      /** Phase 2: async ApprovalRequest workflow for online remote approve. */
      asyncApprovals: false,
    };
  }

  async getPublicConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { securityConfig: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return this.getPublicConfigFromRaw(company.securityConfig);
  }

  private async writeAudit(params: {
    companyId: string;
    userId: string;
    action: string;
    success: boolean;
    details: Record<string, unknown>;
  }) {
    await this.prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        action: params.action,
        entity: 'DualControl',
        entityId: params.companyId,
        newValues: {
          success: params.success,
          ...params.details,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async assertApproved(
    companyId: string,
    actor: DualControlActor,
    action: DualControlAction,
    approval?: DualApprovalDto,
  ): Promise<{ approverId: string; method: string }> {
    const required = await this.isRequired(companyId, action);
    if (!required) {
      return { approverId: actor.sub, method: 'SKIP' };
    }

    if (!approval?.method) {
      await this.writeAudit({
        companyId,
        userId: actor.sub,
        action: `${action}_DENIED`,
        success: false,
        details: { reason: 'MISSING_APPROVAL', actorEmail: actor.email },
      });
      throw new ForbiddenException('Dual control required');
    }

    try {
      const result = await this.validateApproval(companyId, actor, action, approval);
      await this.writeAudit({
        companyId,
        userId: actor.sub,
        action: `${action}_APPROVED`,
        success: true,
        details: {
          method: result.method,
          approverId: result.approverId,
          actorEmail: actor.email,
          actorRole: actor.role,
        },
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'APPROVAL_FAILED';
      await this.writeAudit({
        companyId,
        userId: actor.sub,
        action: `${action}_DENIED`,
        success: false,
        details: {
          reason: message,
          method: approval.method,
          actorEmail: actor.email,
          actorRole: actor.role,
        },
      });
      throw err;
    }
  }

  private async validateApproval(
    companyId: string,
    actor: DualControlActor,
    _action: DualControlAction,
    approval: DualApprovalDto,
  ): Promise<{ approverId: string; method: string }> {
    if (approval.method === 'SELF_CONFIRM') {
      if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
        throw new ForbiddenException(
          'SELF_CONFIRM is only allowed for ADMIN or MANAGER',
        );
      }
      return { approverId: actor.sub, method: 'SELF_CONFIRM' };
    }

    if (approval.method === 'PASSWORD') {
      const email = approval.email?.trim().toLowerCase();
      const password = approval.password;
      if (!email || !password) {
        throw new BadRequestException('Supervisor email and password are required');
      }

      const approver = await this.prisma.user.findFirst({
        where: {
          companyId,
          email: { equals: email, mode: 'insensitive' },
          isActive: true,
          role: { in: APPROVER_ROLES },
        },
      });

      if (!approver?.password) {
        throw new ForbiddenException('Invalid supervisor credentials');
      }

      if (approver.id === actor.sub) {
        throw new ForbiddenException(
          'PASSWORD approval requires a different ADMIN or MANAGER (use SELF_CONFIRM)',
        );
      }

      const ok = await bcrypt.compare(password, approver.password);
      if (!ok) {
        throw new ForbiddenException('Invalid supervisor credentials');
      }

      return { approverId: approver.id, method: 'PASSWORD' };
    }

    if (approval.method === 'PIN') {
      const pin = approval.pin?.trim();
      if (!pin) {
        throw new BadRequestException('Supervisor PIN is required');
      }
      const config = await this.loadConfig(companyId);
      if (!config.supervisorPinHash) {
        throw new BadRequestException('Supervisor PIN is not configured');
      }
      const ok = await bcrypt.compare(pin, config.supervisorPinHash);
      if (!ok) {
        throw new ForbiddenException('Invalid supervisor PIN');
      }
      return { approverId: actor.sub, method: 'PIN' };
    }

    throw new BadRequestException('Unsupported approval method');
  }

  async setSupervisorPin(companyId: string, pin: string, actorAdminId: string) {
    if (!/^\d{4,8}$/.test(pin)) {
      throw new BadRequestException('Supervisor PIN must be 4–8 digits');
    }
    const hash = await bcrypt.hash(pin, 12);
    const config = await this.loadConfig(companyId);
    const next: CompanySecurityConfig = {
      ...config,
      supervisorPinHash: hash,
      methods: config.methods?.length ? config.methods : [...DEFAULT_METHODS],
    };
    await this.prisma.company.update({
      where: { id: companyId },
      data: { securityConfig: next as Prisma.InputJsonValue },
    });
    await this.writeAudit({
      companyId,
      userId: actorAdminId,
      action: 'SUPERVISOR_PIN_SET',
      success: true,
      details: {},
    });
    return this.getPublicConfig(companyId);
  }

  async updateSettings(
    companyId: string,
    dto: UpdateSecurityConfigDto,
    actorAdminId: string,
  ) {
    const config = await this.loadConfig(companyId);
    const next: CompanySecurityConfig = {
      ...config,
      methods: config.methods?.length ? config.methods : [...DEFAULT_METHODS],
    };

    if (dto.dualControlEnabled !== undefined) {
      next.dualControlEnabled = dto.dualControlEnabled;
    }
    if (dto.actions) {
      next.actions = { ...(config.actions || {}), ...dto.actions };
    }
    if (dto.clearSupervisorPin) {
      next.supervisorPinHash = null;
    }
    if (dto.supervisorPin) {
      next.supervisorPinHash = await bcrypt.hash(dto.supervisorPin, 12);
    }

    await this.prisma.company.update({
      where: { id: companyId },
      data: { securityConfig: next as Prisma.InputJsonValue },
    });

    await this.writeAudit({
      companyId,
      userId: actorAdminId,
      action: 'SECURITY_CONFIG_UPDATED',
      success: true,
      details: {
        dualControlEnabled: next.dualControlEnabled,
        actions: next.actions,
        pinChanged: !!dto.supervisorPin || !!dto.clearSupervisorPin,
      },
    });

    return this.getPublicConfig(companyId);
  }
}
