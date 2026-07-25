import { Injectable, Logger } from '@nestjs/common';
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
 * Optionally enriches with an external LLM summary when OPENAI_API_KEY / AI_LLM_API_KEY is set.
 * Does NOT auto-apply accounting or stock changes.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private alerts: ManagementAlertsService,
  ) {}

  private llmConfigured(): boolean {
    return !!(process.env.OPENAI_API_KEY || process.env.AI_LLM_API_KEY);
  }

  private async enrichWithLlm(payload: {
    summary: Record<string, unknown>;
    recommendations: AiSuggestion[];
    fraudRisk: string;
  }): Promise<string | null> {
    const key = process.env.OPENAI_API_KEY || process.env.AI_LLM_API_KEY;
    if (!key) return null;
    const base =
      process.env.AI_LLM_BASE_URL?.replace(/\/$/, '') ||
      'https://api.openai.com/v1';
    const model = process.env.AI_LLM_MODEL || 'gpt-4o-mini';
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 400,
          messages: [
            {
              role: 'system',
              content:
                'You are Hisaby accounting assistant. Summarize risks in Arabic briefly. Never instruct to auto-post journals. Always say human approval is required.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                fraudRisk: payload.fraudRisk,
                summary: payload.summary,
                recommendations: payload.recommendations.map((r) => ({
                  type: r.type,
                  priority: r.priority,
                  title: r.title,
                })),
              }),
            },
          ],
        }),
      });
      if (!res.ok) {
        this.logger.warn(`LLM enrich failed: ${res.status}`);
        return null;
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
      this.logger.warn(
        `LLM enrich error: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

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

    const base = {
      mode: 'human_in_the_loop' as const,
      engine: this.llmConfigured() ? 'rules_v1+llm_summary' : 'rules_v1',
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
      llmNote: null as string | null,
    };

    if (this.llmConfigured()) {
      base.llmNote = await this.enrichWithLlm({
        summary: base.summary,
        recommendations: suggestions,
        fraudRisk,
      });
    }

    return base;
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
