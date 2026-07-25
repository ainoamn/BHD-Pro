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
  DUAL_CONTROL_ACTIONS,
  UpdateSecurityConfigDto,
} from './dto/approval.dto';

export type CompanySecurityConfig = {
  dualControlEnabled?: boolean;
  supervisorPinHash?: string | null;
  /** Enabled methods. OTP / NFC reserved for a later phase. */
  methods?: Array<'SELF_CONFIRM' | 'PASSWORD' | 'PIN' | 'WHATSAPP_OTP' | 'NFC' | 'APPROVAL_REQUEST'>;
  actions?: DualControlActionsDto;
};

export type DualControlActor = {
  sub: string;
  role: string;
  email: string;
};

const APPROVER_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];
const DEFAULT_METHODS = ['SELF_CONFIRM', 'PASSWORD', 'PIN'] as const;
const APPROVAL_TTL_MS = 15 * 60 * 1000;
const APPROVAL_STATUSES = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CONSUMED: 'CONSUMED',
  EXPIRED: 'EXPIRED',
} as const;

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
      methods: [...DEFAULT_METHODS, 'APPROVAL_REQUEST'] as const,
      /** Future: WhatsApp OTP, NFC badge — not implemented in this MVP. */
      futureMethods: ['WHATSAPP_OTP', 'NFC'] as const,
      actions,
      asyncApprovals: true,
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

  private assertKnownAction(action: string): asserts action is DualControlAction {
    if (!(DUAL_CONTROL_ACTIONS as readonly string[]).includes(action)) {
      throw new BadRequestException('Unknown dual-control action');
    }
  }

  async createApprovalRequest(
    companyId: string,
    actor: DualControlActor,
    action: DualControlAction,
    payload: Record<string, unknown>,
    summary?: string,
  ) {
    this.assertKnownAction(action);
    const expiresAt = new Date(Date.now() + APPROVAL_TTL_MS);
    const row = await this.prisma.approvalRequest.create({
      data: {
        companyId,
        action,
        status: APPROVAL_STATUSES.PENDING,
        payloadJson: (payload || {}) as Prisma.InputJsonValue,
        summary: summary?.trim() || null,
        requestedById: actor.sub,
        expiresAt,
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });
    await this.writeAudit({
      companyId,
      userId: actor.sub,
      action: 'APPROVAL_REQUEST_CREATED',
      success: true,
      details: { approvalRequestId: row.id, dualAction: action },
    });
    return this.serializeApproval(row);
  }

  async listPending(companyId: string) {
    await this.expireStale(companyId);
    const rows = await this.prisma.approvalRequest.findMany({
      where: { companyId, status: APPROVAL_STATUSES.PENDING },
      orderBy: { createdAt: 'asc' },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
    return rows.map((r) => this.serializeApproval(r));
  }

  async getApprovalRequest(
    companyId: string,
    id: string,
    actor: DualControlActor,
  ) {
    await this.expireStale(companyId, id);
    const row = await this.prisma.approvalRequest.findFirst({
      where: { id, companyId },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!row) throw new NotFoundException('Approval request not found');
    const isManager =
      actor.role === UserRole.ADMIN || actor.role === UserRole.MANAGER;
    if (!isManager && row.requestedById !== actor.sub) {
      throw new ForbiddenException('Not allowed to view this approval request');
    }
    return this.serializeApproval(row);
  }

  async decide(
    companyId: string,
    approver: DualControlActor,
    id: string,
    approve: boolean,
    note?: string,
  ) {
    if (approver.role !== UserRole.ADMIN && approver.role !== UserRole.MANAGER) {
      throw new ForbiddenException('Only ADMIN or MANAGER can decide approvals');
    }
    await this.expireStale(companyId, id);
    const row = await this.prisma.approvalRequest.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('Approval request not found');
    if (row.status === APPROVAL_STATUSES.EXPIRED) {
      throw new BadRequestException('Approval request expired');
    }
    if (row.status !== APPROVAL_STATUSES.PENDING) {
      throw new BadRequestException('Approval request is no longer pending');
    }
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.prisma.approvalRequest.update({
        where: { id },
        data: { status: APPROVAL_STATUSES.EXPIRED },
      });
      throw new BadRequestException('Approval request expired');
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        status: approve ? APPROVAL_STATUSES.APPROVED : APPROVAL_STATUSES.REJECTED,
        decidedById: approver.sub,
        decisionNote: note?.trim() || null,
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.writeAudit({
      companyId,
      userId: approver.sub,
      action: approve ? 'APPROVAL_REQUEST_APPROVED' : 'APPROVAL_REQUEST_REJECTED',
      success: true,
      details: {
        approvalRequestId: id,
        dualAction: row.action,
        note: note || null,
      },
    });

    return this.serializeApproval(updated);
  }

  /**
   * One-shot consume of an APPROVED request for the given action.
   * Marks CONSUMED and returns approver info for assertApproved.
   */
  async consumeApprovalToken(
    companyId: string,
    actor: DualControlActor,
    action: DualControlAction,
    approvalRequestId: string,
  ): Promise<{ approverId: string; method: string }> {
    await this.expireStale(companyId, approvalRequestId);
    const row = await this.prisma.approvalRequest.findFirst({
      where: { id: approvalRequestId, companyId },
    });
    if (!row) throw new NotFoundException('Approval request not found');
    if (row.requestedById !== actor.sub) {
      throw new ForbiddenException('Approval request belongs to another user');
    }
    if (row.action !== action) {
      throw new ForbiddenException('Approval request action mismatch');
    }
    if (row.status === APPROVAL_STATUSES.EXPIRED || row.expiresAt.getTime() <= Date.now()) {
      if (row.status === APPROVAL_STATUSES.PENDING || row.status === APPROVAL_STATUSES.APPROVED) {
        await this.prisma.approvalRequest.update({
          where: { id: approvalRequestId },
          data: { status: APPROVAL_STATUSES.EXPIRED },
        });
      }
      throw new ForbiddenException('Approval request expired');
    }
    if (row.status === APPROVAL_STATUSES.REJECTED) {
      throw new ForbiddenException('Approval request was rejected');
    }
    if (row.status === APPROVAL_STATUSES.CONSUMED) {
      throw new ForbiddenException('Approval request already used');
    }
    if (row.status !== APPROVAL_STATUSES.APPROVED) {
      throw new ForbiddenException('Approval request is not approved yet');
    }
    if (!row.decidedById) {
      throw new ForbiddenException('Approval request missing approver');
    }

    await this.prisma.approvalRequest.update({
      where: { id: approvalRequestId },
      data: { status: APPROVAL_STATUSES.CONSUMED },
    });

    return { approverId: row.decidedById, method: 'APPROVAL_REQUEST' };
  }

  private async expireStale(companyId: string, id?: string) {
    const where: Prisma.ApprovalRequestWhereInput = {
      companyId,
      status: {
        in: [APPROVAL_STATUSES.PENDING, APPROVAL_STATUSES.APPROVED],
      },
      expiresAt: { lte: new Date() },
      ...(id ? { id } : {}),
    };
    await this.prisma.approvalRequest.updateMany({
      where,
      data: { status: APPROVAL_STATUSES.EXPIRED },
    });
  }

  private serializeApproval(row: {
    id: string;
    companyId: string;
    action: string;
    status: string;
    payloadJson: Prisma.JsonValue;
    summary: string | null;
    requestedById: string;
    decidedById: string | null;
    decisionNote: string | null;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    requestedBy?: { id: string; name: string; email: string };
    decidedBy?: { id: string; name: string; email: string } | null;
  }) {
    return {
      id: row.id,
      companyId: row.companyId,
      action: row.action,
      status: row.status,
      payload: row.payloadJson,
      summary: row.summary,
      requestedById: row.requestedById,
      decidedById: row.decidedById,
      decisionNote: row.decisionNote,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      requestedBy: row.requestedBy,
      decidedBy: row.decidedBy ?? null,
    };
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
          approvalRequestId: approval.approvalRequestId || null,
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
          approvalRequestId: approval.approvalRequestId || null,
        },
      });
      throw err;
    }
  }

  private async validateApproval(
    companyId: string,
    actor: DualControlActor,
    action: DualControlAction,
    approval: DualApprovalDto,
  ): Promise<{ approverId: string; method: string }> {
    if (approval.method === 'APPROVAL_REQUEST') {
      const id = approval.approvalRequestId?.trim();
      if (!id) {
        throw new BadRequestException('approvalRequestId is required');
      }
      return this.consumeApprovalToken(companyId, actor, action, id);
    }

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
