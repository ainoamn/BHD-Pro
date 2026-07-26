import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto, StockAdjustMode } from './dto/adjust-stock.dto';
import { TransferStockDto } from './dto/transfer-stock.dto';
import { MovementType, Prisma, InvoiceStatus, InvoiceType } from '@prisma/client';
import { PeriodsService } from '../periods/periods.service';
import { DualControlService } from '../dual-control/dual-control.service';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ManagementAlertsService } from '../management-alerts/management-alerts.service';

const warehouseStockInclude = {
  warehouseStocks: {
    include: { warehouse: { select: { id: true, code: true, name: true } } },
  },
  warehouse: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private periods: PeriodsService,
    private dualControl: DualControlService,
    private subscriptions: SubscriptionsService,
    private managementAlerts: ManagementAlertsService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      include: warehouseStockInclude,
      orderBy: { name: 'asc' },
    });
  }

  async getStats(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        minQuantity: true,
        costPrice: true,
        isTracked: true,
        unit: true,
      },
    });

    const lowStockItems = products.filter(
      (p) => p.isTracked && Number(p.quantity) <= Number(p.minQuantity),
    );

    const totalValue = products.reduce(
      (s, p) => s + Number(p.quantity) * Number(p.costPrice),
      0,
    );

    return {
      total: products.length,
      lowStock: lowStockItems.length,
      totalValue,
      lowStockItems,
    };
  }

  async ensureDefaultWarehouse(companyId: string) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    return this.prisma.warehouse.create({
      data: {
        companyId,
        code: 'MAIN',
        name: 'المستودع الرئيسي',
        isActive: true,
      },
    });
  }

  private normalizeBarcode(barcode: string | null | undefined): string | null | undefined {
    if (barcode === undefined) return undefined;
    if (barcode === null) return null;
    const trimmed = barcode.trim();
    return trimmed.length ? trimmed : null;
  }

  private ean13CheckDigit(digits12: string): string {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
    }
    return String((10 - (sum % 10)) % 10);
  }

  /** In-store EAN-13 (prefix 2…) — works with hardware scanners and phone cameras. */
  private async allocateBarcode(companyId: string): Promise<string> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const count = await this.prisma.product.count({ where: { companyId } });
      const companyHash = Array.from(companyId.replace(/-/g, ''))
        .reduce((s, ch) => s + ch.charCodeAt(0), 0);
      const companyPart = String(companyHash % 1000).padStart(3, '0');
      const seq = String((count + 1 + attempt) % 100000000).padStart(8, '0');
      // Leading 2 = in-store / private EAN range — scanners + phone cameras
      const body = `2${companyPart}${seq}`.slice(0, 12);
      const code = body + this.ean13CheckDigit(body);
      const taken = await this.prisma.product.findFirst({
        where: { companyId, barcode: code },
        select: { id: true },
      });
      if (!taken) return code;
    }
    // Fallback CODE128-friendly alphanumeric
    return `H${Date.now().toString().slice(-11)}`;
  }

  private async allocateSku(companyId: string): Promise<string> {
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    for (let attempt = 0; attempt < 20; attempt++) {
      const count = await this.prisma.product.count({ where: { companyId } });
      const sku = `P-${day}-${String(count + 1 + attempt).padStart(4, '0')}`;
      const taken = await this.prisma.product.findFirst({
        where: { companyId, sku },
        select: { id: true },
      });
      if (!taken) return sku;
    }
    return `P-${day}-${Date.now().toString(36).toUpperCase()}`;
  }

  private async assertBarcodeAvailable(
    companyId: string,
    barcode: string | null | undefined,
    excludeProductId?: string,
  ) {
    if (!barcode) return;
    const barcodeTaken = await this.prisma.product.findFirst({
      where: {
        companyId,
        barcode,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
    });
    if (barcodeTaken) throw new ConflictException('Barcode already exists');
  }

  private async syncProductQuantity(
    tx: Prisma.TransactionClient,
    productId: string,
    warehouseId?: string,
  ) {
    const agg = await tx.warehouseStock.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    return tx.product.update({
      where: { id: productId },
      data: {
        quantity: agg._sum.quantity ?? 0,
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: warehouseStockInclude,
    });
  }

  async previewNextCodes(companyId: string) {
    const [sku, barcode] = await Promise.all([
      this.allocateSku(companyId),
      this.allocateBarcode(companyId),
    ]);
    return {
      sku,
      barcode,
      barcodeFormat: 'EAN-13',
      noteAr:
        'الباركود EAN-13 يُقرأ بماسح المحل وكاميرا الهاتف في الكاشير. رمز المنتج (SKU) للمرجع الداخلي فقط.',
      noteEn:
        'EAN-13 works with store scanners and phone camera on POS. SKU is an internal reference only.',
    };
  }

  async create(companyId: string, dto: CreateProductDto) {
    await this.subscriptions.assertSubscriptionActive(companyId);

    let sku = dto.sku?.trim() || '';
    if (!sku) {
      sku = await this.allocateSku(companyId);
    } else {
      const existing = await this.prisma.product.findFirst({
        where: { companyId, sku },
      });
      if (existing) throw new ConflictException('SKU already exists');
    }

    let barcode = this.normalizeBarcode(dto.barcode);
    if (barcode === null || barcode === undefined) {
      barcode = await this.allocateBarcode(companyId);
    } else {
      await this.assertBarcodeAvailable(companyId, barcode);
    }

    const warehouse = dto.warehouseId
      ? await this.prisma.warehouse.findFirst({
          where: { id: dto.warehouseId, companyId, isActive: true },
        })
      : await this.ensureDefaultWarehouse(companyId);
    if (!warehouse) throw new BadRequestException('Warehouse not found');

    const { customFieldsJson, barcode: _barcode, sku: _sku, images, warehouseId: _wh, ...rest } =
      dto;
    const qty = Number(dto.quantity ?? 0);
    const imageList = (images || [])
      .map((u) => String(u || '').trim())
      .filter(Boolean)
      .slice(0, 8);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...rest,
          sku,
          barcode,
          companyId,
          images: imageList,
          warehouseId: warehouse.id,
          ...(customFieldsJson !== undefined
            ? { customFieldsJson: customFieldsJson as object }
            : {}),
        },
      });

      if (product.isTracked && qty > 0) {
        await tx.warehouseStock.create({
          data: {
            productId: product.id,
            warehouseId: warehouse.id,
            quantity: qty,
          },
        });
      }

      return tx.product.findFirstOrThrow({
        where: { id: product.id },
        include: warehouseStockInclude,
      });
    });
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(companyId, id);
    const { customFieldsJson, barcode: rawBarcode, images, warehouseId, ...rest } = dto;
    const barcode = this.normalizeBarcode(rawBarcode);
    await this.assertBarcodeAvailable(companyId, barcode, id);

    if (warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId, isActive: true },
      });
      if (!wh) throw new BadRequestException('Warehouse not found');
    }

    const imageList =
      images === undefined
        ? undefined
        : (images || [])
            .map((u) => String(u || '').trim())
            .filter(Boolean)
            .slice(0, 8);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(barcode !== undefined ? { barcode } : {}),
        ...(imageList !== undefined ? { images: imageList } : {}),
        ...(warehouseId !== undefined ? { warehouseId } : {}),
        ...(customFieldsJson !== undefined
          ? { customFieldsJson: customFieldsJson as object }
          : {}),
      },
      include: warehouseStockInclude,
    });
  }

  async findOne(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: warehouseStockInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Net POS units sold today for a product (active sales − refunds).
   * Used to flag inventory recounts that conflict with collected sales.
   */
  private async netPosSoldToday(companyId: string, productId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const sales = await this.prisma.invoiceItem.findMany({
      where: {
        productId,
        invoice: {
          companyId,
          type: InvoiceType.SALES,
          isCash: true,
          notes: { contains: 'Hisaby POS' },
          status: { not: InvoiceStatus.CANCELLED },
          createdAt: { gte: start },
        },
      },
      select: { quantity: true, invoice: { select: { number: true } } },
    });

    let sold = 0;
    const saleNumbers = new Set<string>();
    for (const row of sales) {
      sold += Number(row.quantity);
      saleNumbers.add(row.invoice.number);
    }
    if (sold <= 0) return 0;

    let refunded = 0;
    for (const num of saleNumbers) {
      const cns = await this.prisma.invoice.findMany({
        where: {
          companyId,
          type: InvoiceType.CREDIT_NOTE,
          notes: { contains: `Hisaby POS refund of ${num}` },
          status: { not: InvoiceStatus.CANCELLED },
          createdAt: { gte: start },
        },
        include: { items: { where: { productId }, select: { quantity: true } } },
      });
      for (const cn of cns) {
        for (const it of cn.items) refunded += Number(it.quantity);
      }
    }

    return Number(Math.max(0, sold - refunded).toFixed(3));
  }

  async adjustStock(
    companyId: string,
    id: string,
    dto: AdjustStockDto,
    actor: TokenPayload,
  ) {
    await this.dualControl.assertApproved(
      companyId,
      actor,
      'STOCK_ADJUST',
      dto.approval,
    );
    await this.periods.assertOpen(companyId, new Date());

    const product = await this.findOne(companyId, id);
    if (!product.isTracked) {
      throw new BadRequestException('Product is not stock-tracked');
    }

    const qty = Number(dto.quantity);
    let movementQty = qty;
    let movementType: MovementType = MovementType.ADJUSTMENT;

    if (dto.mode === StockAdjustMode.IN || dto.mode === StockAdjustMode.OUT) {
      if (qty <= 0) throw new BadRequestException('Quantity must be positive');
      movementType = dto.mode === StockAdjustMode.IN ? MovementType.IN : MovementType.OUT;
      movementQty = qty;
    } else {
      movementType = MovementType.ADJUSTMENT;
    }

    let warehouseId = dto.warehouseId || product.warehouseId;
    if (warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
      });
      if (!wh) throw new NotFoundException('Warehouse not found');
    } else {
      const wh = await this.ensureDefaultWarehouse(companyId);
      warehouseId = wh.id;
    }

    const currentPreview = await this.prisma.warehouseStock.findUnique({
      where: {
        productId_warehouseId: { productId: id, warehouseId: warehouseId! },
      },
    });
    const currentWhPreview = Number(currentPreview?.quantity ?? 0);
    const nextWhPreview =
      dto.mode === StockAdjustMode.IN
        ? currentWhPreview + qty
        : dto.mode === StockAdjustMode.OUT
          ? currentWhPreview - qty
          : Number(qty.toFixed(3));
    const isIncrease = nextWhPreview > currentWhPreview + 0.0005;

    if (isIncrease) {
      const netSold = await this.netPosSoldToday(companyId, id);
      if (netSold > 0.0005) {
        const reason = (dto.notes || dto.reference || '').trim();
        if (reason.length < 12) {
          throw new BadRequestException(
            `لا يمكن زيادة المخزون بينما هناك مبيعات كاشير اليوم (${netSold} وحدة) دون ملاحظات تحقيق (12 حرفاً على الأقل). اشرح: جرد فعلي / بضاعة وصلت / خطأ سابق — وإلا ارفض التعديل.`,
          );
        }
        await this.managementAlerts.createAlert({
          companyId,
          type: 'STOCK_VS_SALES_INVESTIGATION',
          severity: 'HIGH',
          title: 'تحقيق: مخزون يتعارض مع مبيعات الكاشير',
          message: `المنتج «${product.name}» زيد مخزونه من ${currentWhPreview} إلى ${nextWhPreview} بينما صافي مبيعات اليوم ${netSold} وحدة. تحقق كيف حُصّل مبلغ البيع مع بقاء كمية في المخزن.`,
          entityType: 'PRODUCT',
          entityId: id,
          payloadJson: {
            productId: id,
            productName: product.name,
            sku: product.sku,
            fromQty: currentWhPreview,
            toQty: nextWhPreview,
            netPosSoldToday: netSold,
            mode: dto.mode,
            notes: reason,
            actorUserId: actor.sub,
          },
        });
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.warehouseStock.upsert({
        where: {
          productId_warehouseId: { productId: id, warehouseId: warehouseId! },
        },
        create: { productId: id, warehouseId: warehouseId!, quantity: 0 },
        update: {},
      });

      const currentRow = await tx.warehouseStock.findUnique({
        where: {
          productId_warehouseId: { productId: id, warehouseId: warehouseId! },
        },
      });
      const currentWh = Number(currentRow?.quantity ?? 0);

      if (dto.mode === StockAdjustMode.IN) {
        await tx.warehouseStock.update({
          where: {
            productId_warehouseId: { productId: id, warehouseId: warehouseId! },
          },
          data: { quantity: { increment: qty } },
        });
      } else if (dto.mode === StockAdjustMode.OUT) {
        const updated = await tx.warehouseStock.updateMany({
          where: {
            productId: id,
            warehouseId: warehouseId!,
            quantity: { gte: qty },
          },
          data: { quantity: { decrement: qty } },
        });
        if (updated.count === 0) {
          throw new BadRequestException('Insufficient stock');
        }
      } else {
        const nextWh = Number(qty.toFixed(3));
        movementQty = Number(Math.abs(nextWh - currentWh).toFixed(3));
        if (movementQty === 0) {
          return tx.product.findFirstOrThrow({
            where: { id },
            include: warehouseStockInclude,
          });
        }
        await tx.warehouseStock.update({
          where: {
            productId_warehouseId: { productId: id, warehouseId: warehouseId! },
          },
          data: { quantity: nextWh },
        });
      }

      await tx.stockMovement.create({
        data: {
          productId: id,
          warehouseId: warehouseId!,
          type: movementType,
          quantity: movementQty,
          unitCost: Number(product.costPrice),
          reference: dto.reference?.trim() || `ADJ:${id}:${Date.now()}`,
          notes:
            dto.mode === StockAdjustMode.SET
              ? `Adjust SET ${currentWh}→${Number(qty.toFixed(3))}${
                  dto.notes?.trim() ? `: ${dto.notes.trim()}` : ''
                }`
              : dto.notes?.trim() || `Adjust ${dto.mode}`,
        },
      });

      return this.syncProductQuantity(tx, id, warehouseId!);
    });
  }

  async reverseLastAdjust(
    companyId: string,
    productId: string,
    actor: TokenPayload,
    approval?: AdjustStockDto['approval'],
  ) {
    await this.dualControl.assertApproved(
      companyId,
      actor,
      'STOCK_ADJUST',
      approval,
    );
    await this.periods.assertOpen(companyId, new Date());
    const product = await this.findOne(companyId, productId);
    if (!product.isTracked) {
      throw new BadRequestException('Product is not stock-tracked');
    }

    const original = await this.prisma.stockMovement.findFirst({
      where: {
        productId,
        product: { companyId },
        OR: [
          { reference: { startsWith: `ADJ:${productId}:` } },
          { notes: { startsWith: 'Adjust ' } },
        ],
        NOT: { reference: { startsWith: 'REV-ADJ:' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!original?.reference) {
      throw new BadRequestException('No stock adjustment to reverse');
    }
    if (original.reference.startsWith('REV-ADJ:')) {
      throw new BadRequestException('Movement already a reversal');
    }

    const revRef = `REV-ADJ:${original.reference}`;
    const already = await this.prisma.stockMovement.findFirst({
      where: { productId, reference: revRef },
    });
    if (already) {
      return { product, alreadyReversed: true, reference: original.reference };
    }

    const qty = Number(original.quantity);
    const whId = original.warehouseId;
    const notes = String(original.notes || '');
    const setMatch = notes.match(/Adjust SET\s+([-\d.]+)→([-\d.]+)/);

    await this.prisma.$transaction(async (tx) => {
      await tx.warehouseStock.upsert({
        where: { productId_warehouseId: { productId, warehouseId: whId } },
        create: { productId, warehouseId: whId, quantity: 0 },
        update: {},
      });

      if (setMatch) {
        const fromQty = Number(setMatch[1]);
        await tx.warehouseStock.update({
          where: { productId_warehouseId: { productId, warehouseId: whId } },
          data: { quantity: fromQty },
        });
        await tx.stockMovement.create({
          data: {
            productId,
            warehouseId: whId,
            type: MovementType.ADJUSTMENT,
            quantity: qty,
            unitCost: Number(product.costPrice),
            reference: revRef,
            notes: `Reverse SET → ${fromQty} (${original.reference})`,
          },
        });
      } else if (original.type === MovementType.IN) {
        const updated = await tx.warehouseStock.updateMany({
          where: { productId, warehouseId: whId, quantity: { gte: qty } },
          data: { quantity: { decrement: qty } },
        });
        if (updated.count === 0) {
          throw new BadRequestException('Insufficient stock to reverse IN adjustment');
        }
        await tx.stockMovement.create({
          data: {
            productId,
            warehouseId: whId,
            type: MovementType.OUT,
            quantity: qty,
            unitCost: Number(product.costPrice),
            reference: revRef,
            notes: `Reverse Adjust IN (${original.reference})`,
          },
        });
      } else if (original.type === MovementType.OUT) {
        await tx.warehouseStock.update({
          where: { productId_warehouseId: { productId, warehouseId: whId } },
          data: { quantity: { increment: qty } },
        });
        await tx.stockMovement.create({
          data: {
            productId,
            warehouseId: whId,
            type: MovementType.IN,
            quantity: qty,
            unitCost: Number(product.costPrice),
            reference: revRef,
            notes: `Reverse Adjust OUT (${original.reference})`,
          },
        });
      } else {
        throw new BadRequestException('Unsupported adjustment movement to reverse');
      }

      const agg = await tx.warehouseStock.aggregate({
        where: { productId },
        _sum: { quantity: true },
      });
      await tx.product.update({
        where: { id: productId },
        data: { quantity: agg._sum.quantity ?? 0 },
      });
    });

    return {
      product: await this.findOne(companyId, productId),
      alreadyReversed: false,
      reference: original.reference,
      reverseReference: revRef,
    };
  }

  async transferStock(
    companyId: string,
    productId: string,
    dto: TransferStockDto,
    actor: TokenPayload,
  ) {
    await this.dualControl.assertApproved(
      companyId,
      actor,
      'STOCK_TRANSFER',
      dto.approval,
    );
    await this.periods.assertOpen(companyId, new Date());

    const product = await this.findOne(companyId, productId);
    if (!product.isTracked) {
      throw new BadRequestException('Product is not stock-tracked');
    }

    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must differ');
    }

    const qty = Number(dto.quantity);
    const warehouses = await this.prisma.warehouse.findMany({
      where: {
        companyId,
        id: { in: [dto.fromWarehouseId, dto.toWarehouseId] },
      },
    });
    const fromWh = warehouses.find((w) => w.id === dto.fromWarehouseId);
    const toWh = warehouses.find((w) => w.id === dto.toWarehouseId);
    if (!fromWh || !toWh) {
      throw new BadRequestException('Warehouse not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.warehouseStock.upsert({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: dto.fromWarehouseId,
          },
        },
        create: {
          productId,
          warehouseId: dto.fromWarehouseId,
          quantity: 0,
        },
        update: {},
      });
      await tx.warehouseStock.upsert({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: dto.toWarehouseId,
          },
        },
        create: {
          productId,
          warehouseId: dto.toWarehouseId,
          quantity: 0,
        },
        update: {},
      });

      const decremented = await tx.warehouseStock.updateMany({
        where: {
          productId,
          warehouseId: dto.fromWarehouseId,
          quantity: { gte: qty },
        },
        data: { quantity: { decrement: qty } },
      });
      if (decremented.count === 0) {
        throw new BadRequestException('Insufficient stock');
      }

      await tx.warehouseStock.update({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: dto.toWarehouseId,
          },
        },
        data: { quantity: { increment: qty } },
      });

      const userNotes = dto.notes?.trim();
      const xferRef =
        dto.reference?.trim() || `XFER:${productId}:${Date.now()}`;
      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: dto.fromWarehouseId,
          type: MovementType.TRANSFER,
          quantity: qty,
          unitCost: Number(product.costPrice),
          reference: xferRef,
          notes: userNotes
            ? `Transfer → ${toWh.code}: ${userNotes}`
            : `Transfer → ${toWh.code}`,
        },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: dto.toWarehouseId,
          type: MovementType.TRANSFER,
          quantity: qty,
          unitCost: Number(product.costPrice),
          reference: xferRef,
          notes: userNotes
            ? `Transfer ← ${fromWh.code}: ${userNotes}`
            : `Transfer ← ${fromWh.code}`,
        },
      });

      return tx.product.update({
        where: { id: productId },
        data: { warehouseId: dto.toWarehouseId },
        include: warehouseStockInclude,
      });
    });
  }

  async reverseLastTransfer(
    companyId: string,
    productId: string,
    actor: TokenPayload,
    approval?: TransferStockDto['approval'],
  ) {
    await this.dualControl.assertApproved(
      companyId,
      actor,
      'STOCK_TRANSFER',
      approval,
    );
    await this.periods.assertOpen(companyId, new Date());
    const product = await this.findOne(companyId, productId);
    if (!product.isTracked) {
      throw new BadRequestException('Product is not stock-tracked');
    }

    const outMove = await this.prisma.stockMovement.findFirst({
      where: {
        productId,
        type: MovementType.TRANSFER,
        notes: { startsWith: 'Transfer →' },
        product: { companyId },
        NOT: { reference: { startsWith: 'REV-XFER:' } },
      },
      orderBy: { createdAt: 'desc' },
      include: { warehouse: { select: { id: true, code: true } } },
    });
    if (!outMove?.reference) {
      throw new BadRequestException('No stock transfer to reverse');
    }
    if (outMove.reference.startsWith('REV-XFER:')) {
      throw new BadRequestException('Transfer already a reversal');
    }

    const revRef = `REV-XFER:${outMove.reference}`;
    const already = await this.prisma.stockMovement.findFirst({
      where: { productId, reference: revRef },
    });
    if (already) {
      return { product, alreadyReversed: true, reference: outMove.reference };
    }

    const pair = await this.prisma.stockMovement.findMany({
      where: {
        productId,
        type: MovementType.TRANSFER,
        reference: outMove.reference,
      },
      include: { warehouse: { select: { id: true, code: true } } },
    });
    const fromMove = pair.find((m) => (m.notes || '').startsWith('Transfer →'));
    const toMove = pair.find((m) => (m.notes || '').startsWith('Transfer ←'));
    if (!fromMove || !toMove) {
      throw new BadRequestException('Incomplete transfer pair');
    }

    const qty = Number(fromMove.quantity);
    const fromWhId = fromMove.warehouseId;
    const toWhId = toMove.warehouseId;

    await this.prisma.$transaction(async (tx) => {
      await tx.warehouseStock.upsert({
        where: { productId_warehouseId: { productId, warehouseId: toWhId } },
        create: { productId, warehouseId: toWhId, quantity: 0 },
        update: {},
      });
      const decremented = await tx.warehouseStock.updateMany({
        where: {
          productId,
          warehouseId: toWhId,
          quantity: { gte: qty },
        },
        data: { quantity: { decrement: qty } },
      });
      if (decremented.count === 0) {
        throw new BadRequestException(
          'Insufficient stock at destination to reverse transfer',
        );
      }
      await tx.warehouseStock.upsert({
        where: { productId_warehouseId: { productId, warehouseId: fromWhId } },
        create: { productId, warehouseId: fromWhId, quantity: qty },
        update: { quantity: { increment: qty } },
      });

      const fromCode = fromMove.warehouse?.code || fromWhId;
      const toCode = toMove.warehouse?.code || toWhId;
      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: toWhId,
          type: MovementType.TRANSFER,
          quantity: qty,
          unitCost: Number(product.costPrice),
          reference: revRef,
          notes: `Transfer → ${fromCode}: reverse ${outMove.reference}`,
        },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: fromWhId,
          type: MovementType.TRANSFER,
          quantity: qty,
          unitCost: Number(product.costPrice),
          reference: revRef,
          notes: `Transfer ← ${toCode}: reverse ${outMove.reference}`,
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: { warehouseId: fromWhId },
      });
    });

    return {
      product: await this.findOne(companyId, productId),
      alreadyReversed: false,
      reference: outMove.reference,
      reverseReference: revRef,
    };
  }

  async listMovements(companyId: string, productId: string) {
    await this.findOne(companyId, productId);
    return this.prisma.stockMovement.findMany({
      where: { productId, product: { companyId } },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
