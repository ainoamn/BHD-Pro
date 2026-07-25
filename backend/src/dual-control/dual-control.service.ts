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
import { WhatsappNotifyService } from '../notifications/whatsapp-notify.service';

export type CompanySecurityConfig = {
  dualControlEnabled?: boolean;
  supervisorPinHash?: string | null;
  /** Phones (E.164 digits) that receive WhatsApp OTP codes */
  whatsappNotifyPhones?: string[];
  /** bcrypt hashes of NFC badge secrets — raw secrets never stored */
  nfcBadgeHashes?: string[];
  /** Max abs cash variance on shift close before dual-control (default 1.000) */
  shiftVarianceLimit?: number;
  /** Cash-out amount requiring SHIFT_CASH_OUT approval (default 20) */
  cashOutApprovalLimit?: number;
  /** When true, POS sales require an open shift (default false — opt-in) */
  requireOpenShift?: boolean;
  /** Auto WhatsApp POS receipts to customer (default true when WA configured) */
  autoSendPosReceipts?: boolean;
  /** Auto email POS receipts (default true when email configured) */
  autoSendPosReceiptEmail?: boolean;
  /** Auto SMS POS receipts (default true when SMS configured) */
  autoSendPosReceiptSms?: boolean;
  /** Auto-email Z-report when shift closes (default false) */
  autoEmailZReportOnClose?: boolean;
  /** Live void alert threshold (default 3) */
  voidAlertThreshold?: number;
  /** Live void alerts on POS shell (default true) */
  voidAlertEnabled?: boolean;
  /** Absolute line discount limit before dual-control (default 5) */
  maxLineDiscountAmount?: number;
  /** Percent of line gross before dual-control (default 20) */
  maxLineDiscountPercent?: number;
  /** Manager emails for Z-report on close */
  zReportNotifyEmails?: string[];
  methods?: Array<'SELF_CONFIRM' | 'PASSWORD' | 'PIN' | 'WHATSAPP_OTP' | 'NFC' | 'APPROVAL_REQUEST'>;
  actions?: DualControlActionsDto;
};

/** Default OMR-ish float variance before SHIFT_CLOSE_VARIANCE */
export const DEFAULT_SHIFT_VARIANCE_LIMIT = 1;
/** Default cash-out amount that requires SHIFT_CASH_OUT */
export const DEFAULT_CASH_OUT_APPROVAL_LIMIT = 20;

export type DualControlActor = {
  sub: string;
  role: string;
  email: string;
};

const APPROVER_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER];
const DEFAULT_METHODS = ['SELF_CONFIRM', 'PASSWORD', 'PIN', 'APPROVAL_REQUEST'] as const;
const OTP_TTL_MS = 10 * 60 * 1000;
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
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
  ) {}

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
      POS_LINE_DISCOUNT: config.actions?.POS_LINE_DISCOUNT !== false,
      POS_REFUND: config.actions?.POS_REFUND !== false,
      STOCK_ADJUST: config.actions?.STOCK_ADJUST !== false,
      STOCK_TRANSFER: config.actions?.STOCK_TRANSFER !== false,
      INVOICE_CANCEL: config.actions?.INVOICE_CANCEL !== false,
      PAYMENT_REVERSE: config.actions?.PAYMENT_REVERSE !== false,
      SHIFT_CLOSE_VARIANCE: config.actions?.SHIFT_CLOSE_VARIANCE !== false,
      SHIFT_CASH_OUT: config.actions?.SHIFT_CASH_OUT !== false,
      PAYROLL_PAY: config.actions?.PAYROLL_PAY !== false,
      CLAIM_PAY: config.actions?.CLAIM_PAY !== false,
      BANK_INTERNAL_TRANSFER: config.actions?.BANK_INTERNAL_TRANSFER !== false,
      RESTO_VOID: config.actions?.RESTO_VOID !== false,
    };
    const whatsappReady = this.whatsapp.isConfigured();
    const nfcBadgesConfigured = (config.nfcBadgeHashes || []).length > 0;
    const methods: string[] = [...DEFAULT_METHODS];
    if (whatsappReady) methods.push('WHATSAPP_OTP');
    if (nfcBadgesConfigured) methods.push('NFC');
    const futureMethods: string[] = [];
    if (!whatsappReady) futureMethods.push('WHATSAPP_OTP');
    if (!nfcBadgesConfigured) futureMethods.push('NFC');
    const shiftVarianceLimit =
      typeof config.shiftVarianceLimit === 'number' && config.shiftVarianceLimit >= 0
        ? config.shiftVarianceLimit
        : DEFAULT_SHIFT_VARIANCE_LIMIT;
    return {
      dualControlEnabled,
      hasSupervisorPin: !!config.supervisorPinHash,
      methods,
      futureMethods,
      whatsappConfigured: whatsappReady,
      whatsappNotifyPhones: (config.whatsappNotifyPhones || []).map((p) =>
        String(p).replace(/\d(?=\d{4})/g, '*'),
      ),
      nfcBadgesConfigured,
      nfcBadgeCount: (config.nfcBadgeHashes || []).length,
      shiftVarianceLimit,
      cashOutApprovalLimit:
        typeof config.cashOutApprovalLimit === 'number' &&
        config.cashOutApprovalLimit >= 0
          ? config.cashOutApprovalLimit
          : DEFAULT_CASH_OUT_APPROVAL_LIMIT,
      requireOpenShift: config.requireOpenShift === true,
      /** Default on when WhatsApp is configured; false only when explicitly disabled */
      autoSendPosReceipts: config.autoSendPosReceipts === false ? false : true,
      autoSendPosReceiptEmail:
        config.autoSendPosReceiptEmail === false ? false : true,
      autoSendPosReceiptSms: config.autoSendPosReceiptSms === false ? false : true,
      autoEmailZReportOnClose: config.autoEmailZReportOnClose === true,
      voidAlertEnabled: config.voidAlertEnabled === false ? false : true,
      voidAlertThreshold:
        typeof config.voidAlertThreshold === 'number' &&
        config.voidAlertThreshold >= 0
          ? Number(config.voidAlertThreshold)
          : 3,
      maxLineDiscountAmount:
        typeof config.maxLineDiscountAmount === 'number' &&
        config.maxLineDiscountAmount >= 0
          ? Number(config.maxLineDiscountAmount)
          : 5,
      maxLineDiscountPercent:
        typeof config.maxLineDiscountPercent === 'number' &&
        config.maxLineDiscountPercent >= 0
          ? Number(config.maxLineDiscountPercent)
          : 20,
      zReportNotifyEmails: (config.zReportNotifyEmails || [])
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => e.includes('@')),
      actions,
      asyncApprovals: true,
    };
  }

  async getShiftVarianceLimit(companyId: string): Promise<number> {
    const config = await this.loadConfig(companyId);
    if (typeof config.shiftVarianceLimit === 'number' && config.shiftVarianceLimit >= 0) {
      return config.shiftVarianceLimit;
    }
    return DEFAULT_SHIFT_VARIANCE_LIMIT;
  }

  async getCashOutApprovalLimit(companyId: string): Promise<number> {
    const config = await this.loadConfig(companyId);
    if (
      typeof config.cashOutApprovalLimit === 'number' &&
      config.cashOutApprovalLimit >= 0
    ) {
      return config.cashOutApprovalLimit;
    }
    return DEFAULT_CASH_OUT_APPROVAL_LIMIT;
  }

  /** Opt-in: default false so existing tenants are not blocked */
  async isRequireOpenShift(companyId: string): Promise<boolean> {
    const config = await this.loadConfig(companyId);
    return config.requireOpenShift === true;
  }

  async getZReportEmailSettings(companyId: string): Promise<{
    enabled: boolean;
    emails: string[];
  }> {
    const config = await this.loadConfig(companyId);
    const emails = (config.zReportNotifyEmails || [])
      .map((e) => String(e || '').trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    return {
      enabled: config.autoEmailZReportOnClose === true && emails.length > 0,
      emails,
    };
  }

  async getLineDiscountLimits(companyId: string): Promise<{
    amount: number;
    percent: number;
  }> {
    const config = await this.loadConfig(companyId);
    return {
      amount:
        typeof config.maxLineDiscountAmount === 'number' &&
        config.maxLineDiscountAmount >= 0
          ? Number(config.maxLineDiscountAmount)
          : 5,
      percent:
        typeof config.maxLineDiscountPercent === 'number' &&
        config.maxLineDiscountPercent >= 0
          ? Number(config.maxLineDiscountPercent)
          : 20,
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

    // Best-effort manager WhatsApp ping — never fail request creation
    void this.notifyManagersOfApprovalRequest(companyId, actor, action, row.id);

    return this.serializeApproval(row);
  }

  /** Resolve notify phones (config → company phone) and send a short bilingual alert. */
  private async notifyManagersOfApprovalRequest(
    companyId: string,
    actor: DualControlActor,
    action: DualControlAction,
    approvalRequestId: string,
  ) {
    try {
      if (!this.whatsapp.isConfigured()) return;

      const config = await this.loadConfig(companyId);
      const phones = (config.whatsappNotifyPhones || [])
        .map((p) => String(p).replace(/[^\d]/g, ''))
        .filter((p) => p.length >= 8);

      let targets = phones;
      if (!targets.length) {
        const company = await this.prisma.company.findUnique({
          where: { id: companyId },
          select: { phone: true },
        });
        const fallback = company?.phone?.replace(/[^\d]/g, '') || '';
        if (fallback.length >= 8) targets = [fallback];
      }
      if (!targets.length) return;

      const actorEmail = actor.email || actor.sub;
      const body = `Hisaby: موافقة مطلوبة — ${action} من ${actorEmail}. افتح /pos/approvals\nHisaby: Approval needed — ${action} by ${actorEmail}. Open /pos/approvals`;
      const results = await Promise.all(targets.map((to) => this.whatsapp.sendText(to, body)));
      const anyOk = results.some((r) => r.ok);
      if (!anyOk) return;

      await this.writeAudit({
        companyId,
        userId: actor.sub,
        action: 'APPROVAL_REQUEST_NOTIFIED',
        success: true,
        details: {
          approvalRequestId,
          dualAction: action,
          targets: targets.length,
        },
      });
    } catch {
      /* ignore — notification must not block approval creation */
    }
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

  /** Recent decided/consumed/expired approvals for manager audit on POS */
  async listHistory(companyId: string, limit = 40) {
    await this.expireStale(companyId);
    const take = Math.min(Math.max(limit || 40, 1), 100);
    const rows = await this.prisma.approvalRequest.findMany({
      where: {
        companyId,
        status: {
          in: [
            APPROVAL_STATUSES.APPROVED,
            APPROVAL_STATUSES.REJECTED,
            APPROVAL_STATUSES.CONSUMED,
            APPROVAL_STATUSES.EXPIRED,
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
      take,
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

    if (approval.method === 'WHATSAPP_OTP') {
      const otp = approval.otp?.trim();
      if (!otp || !/^\d{6}$/.test(otp)) {
        throw new BadRequestException('Valid 6-digit WhatsApp OTP is required');
      }
      const row = await this.prisma.dualControlOtp.findFirst({
        where: {
          companyId,
          action,
          requestedById: actor.sub,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!row) {
        throw new ForbiddenException('WhatsApp OTP expired or not requested');
      }
      const ok = await bcrypt.compare(otp, row.codeHash);
      if (!ok) {
        throw new ForbiddenException('Invalid WhatsApp OTP');
      }
      await this.prisma.dualControlOtp.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      return { approverId: actor.sub, method: 'WHATSAPP_OTP' };
    }

    if (approval.method === 'NFC') {
      const secret = approval.badgeSecret?.trim();
      if (!secret || secret.length < 4) {
        throw new BadRequestException('NFC badge secret is required');
      }
      const config = await this.loadConfig(companyId);
      const hashes = config.nfcBadgeHashes || [];
      if (!hashes.length) {
        throw new BadRequestException('No NFC badges configured');
      }
      let matched = false;
      for (const hash of hashes) {
        if (await bcrypt.compare(secret, hash)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        throw new ForbiddenException('Invalid NFC badge');
      }
      await this.writeAudit({
        companyId,
        userId: actor.sub,
        action: 'NFC_OK',
        success: true,
        details: { dualAction: action },
      });
      return { approverId: actor.sub, method: 'NFC' };
    }

    throw new BadRequestException('Unsupported approval method');
  }

  /** Send a 6-digit OTP to configured manager WhatsApp numbers. */
  async requestWhatsappOtp(
    companyId: string,
    actor: DualControlActor,
    action: DualControlAction,
  ) {
    this.assertKnownAction(action);
    if (!this.whatsapp.isConfigured()) {
      throw new BadRequestException(
        'WhatsApp OTP is not configured (set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID)',
      );
    }

    const config = await this.loadConfig(companyId);
    const phones = (config.whatsappNotifyPhones || [])
      .map((p) => String(p).replace(/[^\d]/g, ''))
      .filter((p) => p.length >= 8);

    let targets = phones;
    if (!targets.length) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { phone: true },
      });
      const fallback = company?.phone?.replace(/[^\d]/g, '') || '';
      if (fallback.length >= 8) targets = [fallback];
    }
    if (!targets.length) {
      throw new BadRequestException(
        'No WhatsApp notify phones configured (security settings or company phone)',
      );
    }

    // Rate-limit: max 3 OTPs per actor+action in 10 minutes
    const since = new Date(Date.now() - OTP_TTL_MS);
    const recent = await this.prisma.dualControlOtp.count({
      where: {
        companyId,
        action,
        requestedById: actor.sub,
        createdAt: { gte: since },
      },
    });
    if (recent >= 3) {
      throw new BadRequestException('Too many WhatsApp OTP requests — wait a few minutes');
    }

    // Invalidate unused prior OTPs for this actor+action
    await this.prisma.dualControlOtp.updateMany({
      where: {
        companyId,
        action,
        requestedById: actor.sub,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.prisma.dualControlOtp.create({
      data: {
        companyId,
        action,
        requestedById: actor.sub,
        codeHash,
        sentTo: targets[0],
        expiresAt,
      },
    });

    const body = `Hisaby dual-control OTP: ${code}\nAction: ${action}\nValid 10 minutes.\nDo not share this code.`;
    const results = await Promise.all(targets.map((to) => this.whatsapp.sendText(to, body)));
    const anyOk = results.some((r) => r.ok);
    if (!anyOk) {
      throw new BadRequestException(results[0]?.error || 'Failed to send WhatsApp OTP');
    }

    await this.writeAudit({
      companyId,
      userId: actor.sub,
      action: 'WHATSAPP_OTP_SENT',
      success: true,
      details: { dualAction: action, targets: targets.length },
    });

    return {
      sent: true,
      expiresAt,
      maskedTo: targets.map((p) => p.replace(/\d(?=\d{4})/g, '*')),
      remainingRequests: Math.max(0, 3 - recent - 1),
    };
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
    if (dto.whatsappNotifyPhones !== undefined) {
      next.whatsappNotifyPhones = dto.whatsappNotifyPhones
        .map((p) => String(p).replace(/[^\d]/g, ''))
        .filter((p) => p.length >= 8);
    }
    if (dto.clearNfcBadges) {
      next.nfcBadgeHashes = [];
    }
    if (dto.addNfcBadgeSecret?.trim()) {
      const secret = dto.addNfcBadgeSecret.trim();
      if (secret.length < 4) {
        throw new BadRequestException('NFC badge secret must be at least 4 characters');
      }
      const hash = await bcrypt.hash(secret, 12);
      next.nfcBadgeHashes = [...(next.nfcBadgeHashes || config.nfcBadgeHashes || []), hash];
    }
    if (dto.shiftVarianceLimit !== undefined) {
      next.shiftVarianceLimit = Number(dto.shiftVarianceLimit);
    }
    if (dto.cashOutApprovalLimit !== undefined) {
      next.cashOutApprovalLimit = Number(dto.cashOutApprovalLimit);
    }
    if (dto.requireOpenShift !== undefined) {
      next.requireOpenShift = !!dto.requireOpenShift;
    }
    if (dto.autoSendPosReceipts !== undefined) {
      next.autoSendPosReceipts = !!dto.autoSendPosReceipts;
    }
    if (dto.autoSendPosReceiptEmail !== undefined) {
      next.autoSendPosReceiptEmail = !!dto.autoSendPosReceiptEmail;
    }
    if (dto.autoSendPosReceiptSms !== undefined) {
      next.autoSendPosReceiptSms = !!dto.autoSendPosReceiptSms;
    }
    if (dto.autoEmailZReportOnClose !== undefined) {
      next.autoEmailZReportOnClose = !!dto.autoEmailZReportOnClose;
    }
    if (dto.voidAlertEnabled !== undefined) {
      next.voidAlertEnabled = !!dto.voidAlertEnabled;
    }
    if (dto.voidAlertThreshold !== undefined) {
      next.voidAlertThreshold = Math.max(0, Number(dto.voidAlertThreshold));
    }
    if (dto.maxLineDiscountAmount !== undefined) {
      next.maxLineDiscountAmount = Math.max(
        0,
        Number(dto.maxLineDiscountAmount),
      );
    }
    if (dto.maxLineDiscountPercent !== undefined) {
      next.maxLineDiscountPercent = Math.max(
        0,
        Number(dto.maxLineDiscountPercent),
      );
    }
    if (dto.zReportNotifyEmails !== undefined) {
      next.zReportNotifyEmails = dto.zReportNotifyEmails
        .map((e) => String(e || '').trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        .slice(0, 20);
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
        nfcBadgeAdded: !!dto.addNfcBadgeSecret,
        nfcBadgesCleared: !!dto.clearNfcBadges,
        nfcBadgeCount: (next.nfcBadgeHashes || []).length,
        shiftVarianceLimit: next.shiftVarianceLimit,
        requireOpenShift: next.requireOpenShift,
      },
    });

    return this.getPublicConfig(companyId);
  }
}
