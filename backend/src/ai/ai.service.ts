import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ManagementAlertsService } from '../management-alerts/management-alerts.service';

export type AiSuggestion = {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  /** Suggestions never auto-apply — manager must approve via management alerts */
  requiresHumanApproval: true;
  alertId?: string;
};

/**
 * Rule-based assistant with human-in-the-loop.
 * Does NOT call external LLM APIs. Proposals become ManagementAlert rows for review.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private alerts: ManagementAlertsService,
  ) {}

  async getAnalytics(companyId: string) {
    const [invoices, products, invoiceStats, openAlerts] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { companyId, type: 'SALES' },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, total: true, number: true },
      }),
      this.prisma.product.findMany({
        where: { companyId, isActive: true },
        select: {
          id: true,
          name: true,
          quantity: true,
          minQuantity: true,
          isTracked: true,
        },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, type: 'SALES' },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.managementAlert.findMany({
        where: { companyId, status: 'OPEN', type: { startsWith: 'AI_' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const lowStock = products.filter(
      (p) => p.isTracked && Number(p.quantity) <= Number(p.minQuantity || 0),
    );
    const totalRevenue = Number(invoiceStats._sum.total || 0);
    const avgInvoice = invoiceStats._count > 0 ? totalRevenue / invoiceStats._count : 0;

    // Simple trailing average — labeled as heuristic, not ML forecast
    const recent = invoices.slice(0, 12);
    const recentSum = recent.reduce((s, i) => s + Number(i.total), 0);
    const heuristicNext =
      recent.length > 0 ? (recentSum / recent.length) * recent.length : totalRevenue * 0.1;

    const monthlyData = [...invoices]
      .reverse()
      .map((inv) => ({ month: inv.date, revenue: Number(inv.total) }));

    const suggestions: AiSuggestion[] = [];

    if (lowStock.length > 0) {
      suggestions.push({
        id: `low-stock-${lowStock.length}`,
        type: 'inventory',
        priority: lowStock.length > 5 ? 'high' : 'medium',
        title: 'مخزون منخفض — يحتاج موافقة بشرية للمتابعة',
        titleEn: 'Low stock — human review required',
        description: `${lowStock.length} منتج تحت الحد الأدنى. راجع التنبيه ثم نفّذ أمر شراء يدوياً.`,
        descriptionEn: `${lowStock.length} products below min qty. Review the alert then place a purchase order manually.`,
        requiresHumanApproval: true,
      });
    }

    if (invoiceStats._count < 5) {
      suggestions.push({
        id: 'growth-low-volume',
        type: 'growth',
        priority: 'medium',
        title: 'حجم فواتير منخفض',
        titleEn: 'Low invoice volume',
        description: 'اقتراح تشغيلي فقط — لا يُنفَّذ تلقائياً. راجع قنوات البيع والكاشير.',
        descriptionEn: 'Operational suggestion only — never auto-applied. Review sales channels and POS.',
        requiresHumanApproval: true,
      });
    }

    // Rough spike detection vs median of recent totals
    if (recent.length >= 5) {
      const amounts = recent.map((i) => Number(i.total)).sort((a, b) => a - b);
      const median = amounts[Math.floor(amounts.length / 2)] || 0;
      const latest = amounts[amounts.length - 1] || Number(recent[0]?.total || 0);
      if (median > 0 && latest > median * 3) {
        suggestions.push({
          id: `spike-${recent[0]?.id}`,
          type: 'fraud',
          priority: 'high',
          title: 'مبلغ بيع أعلى من المعتاد',
          titleEn: 'Unusual sale amount',
          description: `آخر فاتورة أعلى بكثير من الوسيط (${median.toFixed(3)}). راجع يدوياً قبل أي إجراء.`,
          descriptionEn: `Latest sale far above median (${median.toFixed(3)}). Review manually before acting.`,
          requiresHumanApproval: true,
        });
      }
    }

    const anomalyScore = Math.min(
      1,
      lowStock.length * 0.05 + (suggestions.some((s) => s.type === 'fraud') ? 0.35 : 0.08),
    );
    const fraudRisk =
      anomalyScore > 0.5 ? 'high' : anomalyScore > 0.25 ? 'medium' : 'low';

    return {
      mode: 'human_in_the_loop' as const,
      engine: 'rules_v1',
      disclaimerAr:
        'المساعد يقترح فقط. لا يُرسل فواتير ولا يغيّر مخزوناً ولا يدفع رواتب بدون موافقة بشرية من تنبيهات الإدارة.',
      disclaimerEn:
        'Assistant proposes only. It never posts invoices, stock, or payroll without human approval via management alerts.',
      summary: {
        totalRevenue,
        avgInvoice,
        forecast: heuristicNext,
        forecastLabel: 'heuristic_trailing_average',
        invoiceCount: invoiceStats._count,
        lowStockCount: lowStock.length,
      },
      monthlyData,
      recommendations: suggestions,
      pendingHumanReviews: openAlerts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        severity: a.severity,
        status: a.status,
        createdAt: a.createdAt,
      })),
      anomalyScore,
      fraudRisk,
    };
  }

  /** Push current suggestions into ManagementAlert queue for managers. */
  async proposeToManagers(companyId: string) {
    const analytics = await this.getAnalytics(companyId);
    const created: string[] = [];

    for (const s of analytics.recommendations) {
      const existing = await this.prisma.managementAlert.findFirst({
        where: {
          companyId,
          status: 'OPEN',
          type: `AI_${s.type.toUpperCase()}`,
          title: s.title,
        },
      });
      if (existing) continue;

      const alert = await this.alerts.createAlert({
        companyId,
        type: `AI_${s.type.toUpperCase()}`,
        severity:
          s.priority === 'critical' || s.priority === 'high'
            ? 'HIGH'
            : s.priority === 'medium'
              ? 'MEDIUM'
              : 'LOW',
        title: s.title,
        message: `${s.description}\n\n(Requires human approval — AI does not auto-apply)`,
        payloadJson: {
          suggestionId: s.id,
          titleEn: s.titleEn,
          descriptionEn: s.descriptionEn,
          requiresHumanApproval: true,
          engine: 'rules_v1',
        },
      });
      created.push(alert.id);
    }

    this.logger.log(`AI proposed ${created.length} alerts for company ${companyId}`);
    return {
      createdCount: created.length,
      alertIds: created,
      message: 'Suggestions queued for human review in management alerts',
    };
  }
}
