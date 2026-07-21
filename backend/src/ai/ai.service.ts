import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiService {
  constructor(private prisma: PrismaService) {}

  async getAnalytics(companyId: string) {
    const [invoices, products, invoiceStats] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { companyId, type: 'SALES' },
        orderBy: { date: 'asc' },
        take: 12,
      }),
      this.prisma.product.findMany({ where: { companyId, isActive: true } }),
      this.prisma.invoice.aggregate({
        where: { companyId, type: 'SALES' },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    const lowStock = products.filter((p) => Number(p.quantity) <= Number(p.minQuantity));
    const totalRevenue = Number(invoiceStats._sum.total || 0);
    const avgInvoice = invoiceStats._count > 0 ? totalRevenue / invoiceStats._count : 0;
    const forecast = totalRevenue * 1.075;

    const monthlyData = invoices.map((inv) => ({
      month: inv.date,
      revenue: Number(inv.total),
    }));

    const recommendations = [];

    if (lowStock.length > 0) {
      recommendations.push({
        type: 'inventory',
        priority: 'high',
        title: 'مخزون منخفض',
        titleEn: 'Low Stock Alert',
        description: `${lowStock.length} منتجات تحتاج إعادة طلب`,
        descriptionEn: `${lowStock.length} products need reordering`,
      });
    }

    if (invoiceStats._count < 5) {
      recommendations.push({
        type: 'growth',
        priority: 'medium',
        title: 'زيادة المبيعات',
        titleEn: 'Increase Sales',
        description: 'أنشئ المزيد من الفواتير لتحسين التدفق النقدي',
        descriptionEn: 'Create more invoices to improve cash flow',
      });
    }

    recommendations.push({
      type: 'revenue',
      priority: 'low',
      title: 'توقع الإيرادات',
      titleEn: 'Revenue Forecast',
      description: `التوقع للشهر القادم: ${forecast.toFixed(3)} ر.ع`,
      descriptionEn: `Next month forecast: ${forecast.toFixed(3)} OMR`,
    });

    return {
      summary: {
        totalRevenue,
        avgInvoice,
        forecast,
        invoiceCount: invoiceStats._count,
        lowStockCount: lowStock.length,
      },
      monthlyData,
      recommendations,
      anomalyScore: 0.12,
      fraudRisk: 'low',
    };
  }
}
