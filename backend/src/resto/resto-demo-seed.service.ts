import { Injectable } from '@nestjs/common';
import { Prisma, WarehouseSector } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DemoProduct = {
  sku: string;
  name: string;
  nameEn: string;
  category: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  unit: string;
  isTracked: boolean;
  image: string;
  warehouseCode: string;
  station?: 'kitchen' | 'bar';
};

const DEMO_TAG = { demoSeed: true } as const;

/** Stable food/retail placeholders (Unsplash crop) — editable via inventory */
const IMG = {
  shawarma:
    'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=640&h=480&fit=crop',
  burger:
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=640&h=480&fit=crop',
  pizza:
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=640&h=480&fit=crop',
  salad:
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=640&h=480&fit=crop',
  juice:
    'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=640&h=480&fit=crop',
  coffee:
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=640&h=480&fit=crop',
  cake:
    'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=640&h=480&fit=crop',
  grilled:
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=640&h=480&fit=crop',
  rice:
    'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=640&h=480&fit=crop',
  oil: 'https://images.unsplash.com/photo-1474979266404-7ea403a0626d?w=640&h=480&fit=crop',
  milk:
    'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=640&h=480&fit=crop',
  chips:
    'https://images.unsplash.com/photo-1566478989034-cb0233fdc3e0?w=640&h=480&fit=crop',
  water:
    'https://images.unsplash.com/photo-1548832336-ea647f8242ad?w=640&h=480&fit=crop',
  soap:
    'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=640&h=480&fit=crop',
};

@Injectable()
export class RestoDemoSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async seed(companyId: string) {
    const branches = await this.upsertBranches(companyId);
    const warehouses = await this.upsertWarehouses(companyId, branches);
    const stations = await this.ensureStations(companyId);
    const products = await this.upsertProducts(companyId, warehouses);
    await this.routeStations(companyId, products, stations);

    const restoWh = warehouses['WH-DEMO-REST'];
    if (restoWh) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          restoLinkedAt: new Date(),
          restoWarehouseId: restoWh.id,
        },
      });
    }

    const posWh = warehouses['WH-DEMO-GROC'];
    if (posWh) {
      await this.prisma.company.update({
        where: { id: companyId },
        data: {
          posLinkedAt: new Date(),
          posWarehouseId: posWh.id,
        },
      });
    }

    await this.seedFloorIfEmpty(companyId);

    return {
      ok: true,
      branches: Object.keys(branches).length,
      warehouses: Object.keys(warehouses).length,
      products: products.length,
      restoWarehouseId: restoWh?.id ?? null,
      posWarehouseId: posWh?.id ?? null,
      message:
        'Demo branches, warehouses, meals (with images), and retail SKUs are ready — edit or delete like any normal record (SKU prefix DEMO-)',
    };
  }

  /** Remove only DEMO-* seeded rows (safe purge) */
  async purge(companyId: string) {
    const demoProducts = await this.prisma.product.findMany({
      where: { companyId, sku: { startsWith: 'DEMO-' } },
      select: { id: true },
    });
    const ids = demoProducts.map((p) => p.id);
    if (ids.length) {
      await this.prisma.restoProductStation.deleteMany({
        where: { companyId, productId: { in: ids } },
      });
      await this.prisma.restoRecipeItem.deleteMany({
        where: { recipe: { companyId, productId: { in: ids } } },
      }).catch(() => undefined);
      await this.prisma.restoRecipe.deleteMany({
        where: { companyId, productId: { in: ids } },
      }).catch(() => undefined);
      await this.prisma.warehouseStock.deleteMany({
        where: { productId: { in: ids } },
      });
      await this.prisma.product.deleteMany({
        where: { companyId, id: { in: ids } },
      });
    }

    await this.prisma.company.updateMany({
      where: { id: companyId },
      data: {
        restoWarehouseId: null,
        posWarehouseId: null,
      },
    });

    const wh = await this.prisma.warehouse.findMany({
      where: { companyId, code: { startsWith: 'WH-DEMO-' } },
      select: { id: true },
    });
    if (wh.length) {
      await this.prisma.warehouse.deleteMany({
        where: { companyId, id: { in: wh.map((w) => w.id) } },
      });
    }

    const br = await this.prisma.branch.findMany({
      where: { companyId, code: { startsWith: 'BR-DEMO-' } },
      select: { id: true },
    });
    if (br.length) {
      await this.prisma.branch.deleteMany({
        where: { companyId, id: { in: br.map((b) => b.id) } },
      });
    }

    return {
      ok: true,
      deletedProducts: ids.length,
      deletedWarehouses: wh.length,
      deletedBranches: br.length,
    };
  }

  private async upsertBranches(companyId: string) {
    const defs = [
      {
        code: 'BR-DEMO-REST',
        name: 'فرع المطعم الرئيسي',
        nameEn: 'Main Restaurant Branch',
        city: 'مسقط',
        isHeadOffice: true,
      },
      {
        code: 'BR-DEMO-CAFE',
        name: 'فرع المقهى',
        nameEn: 'Cafe Branch',
        city: 'مسقط',
        isHeadOffice: false,
      },
      {
        code: 'BR-DEMO-GROC',
        name: 'فرع البقالة',
        nameEn: 'Grocery Branch',
        city: 'السيب',
        isHeadOffice: false,
      },
    ];
    const map: Record<string, { id: string; code: string }> = {};
    for (const d of defs) {
      const row = await this.prisma.branch.upsert({
        where: { companyId_code: { companyId, code: d.code } },
        create: {
          companyId,
          code: d.code,
          name: d.name,
          nameEn: d.nameEn,
          city: d.city,
          isHeadOffice: d.isHeadOffice,
          isActive: true,
        },
        update: {
          name: d.name,
          nameEn: d.nameEn,
          city: d.city,
          isActive: true,
        },
      });
      map[d.code] = { id: row.id, code: row.code };
    }
    return map;
  }

  private async upsertWarehouses(
    companyId: string,
    branches: Record<string, { id: string; code: string }>,
  ) {
    const defs: Array<{
      code: string;
      name: string;
      nameEn: string;
      sector: WarehouseSector;
      branchCode?: string;
      address: string;
    }> = [
      {
        code: 'WH-DEMO-REST',
        name: 'مخزن المطعم — وجبات',
        nameEn: 'Restaurant kitchen store',
        sector: WarehouseSector.RESTAURANT,
        branchCode: 'BR-DEMO-REST',
        address: 'صالة المطعم',
      },
      {
        code: 'WH-DEMO-CAFE',
        name: 'مخزن المقهى — مشروبات وحلويات',
        nameEn: 'Cafe bar store',
        sector: WarehouseSector.RESTAURANT,
        branchCode: 'BR-DEMO-CAFE',
        address: 'الكافيه',
      },
      {
        code: 'WH-DEMO-GROC',
        name: 'مخزن البقالة',
        nameEn: 'Grocery retail store',
        sector: WarehouseSector.RETAIL,
        branchCode: 'BR-DEMO-GROC',
        address: 'السيب',
      },
      {
        code: 'WH-DEMO-CENTRAL',
        name: 'مخزن مركزي عام',
        nameEn: 'Central general store',
        sector: WarehouseSector.GENERAL,
        address: 'المستودع الرئيسي',
      },
    ];

    const map: Record<string, { id: string; code: string }> = {};
    for (const d of defs) {
      const existing = await this.prisma.warehouse.findFirst({
        where: { companyId, code: d.code },
      });
      const branchId = d.branchCode ? branches[d.branchCode]?.id : null;
      const row = existing
        ? await this.prisma.warehouse.update({
            where: { id: existing.id },
            data: {
              name: d.name,
              nameEn: d.nameEn,
              sector: d.sector,
              branchId,
              address: d.address,
              isActive: true,
            },
          })
        : await this.prisma.warehouse.create({
            data: {
              companyId,
              code: d.code,
              name: d.name,
              nameEn: d.nameEn,
              sector: d.sector,
              branchId,
              address: d.address,
              isActive: true,
            },
          });
      map[d.code] = { id: row.id, code: row.code };
    }
    return map;
  }

  private async ensureStations(companyId: string) {
    const kitchen =
      (await this.prisma.restoStation.findFirst({
        where: { companyId, nameEn: 'Kitchen' },
      })) ||
      (await this.prisma.restoStation.create({
        data: {
          companyId,
          name: 'المطبخ',
          nameEn: 'Kitchen',
          sortOrder: 0,
        },
      }));
    const bar =
      (await this.prisma.restoStation.findFirst({
        where: { companyId, nameEn: 'Bar' },
      })) ||
      (await this.prisma.restoStation.create({
        data: {
          companyId,
          name: 'البار',
          nameEn: 'Bar',
          sortOrder: 1,
        },
      }));
    return { kitchen, bar };
  }

  private catalog(): DemoProduct[] {
    return [
      {
        sku: 'DEMO-MEAL-SHAWARMA',
        name: 'شاورما دجاج',
        nameEn: 'Chicken Shawarma',
        category: 'وجبات',
        costPrice: 0.8,
        salePrice: 1.8,
        quantity: 50,
        unit: 'pcs',
        isTracked: true,
        image: IMG.shawarma,
        warehouseCode: 'WH-DEMO-REST',
        station: 'kitchen',
      },
      {
        sku: 'DEMO-MEAL-BURGER',
        name: 'برجر لحم',
        nameEn: 'Beef Burger',
        category: 'وجبات',
        costPrice: 1.1,
        salePrice: 2.5,
        quantity: 40,
        unit: 'pcs',
        isTracked: true,
        image: IMG.burger,
        warehouseCode: 'WH-DEMO-REST',
        station: 'kitchen',
      },
      {
        sku: 'DEMO-MEAL-PIZZA',
        name: 'بيتزا مارغريتا',
        nameEn: 'Margherita Pizza',
        category: 'وجبات',
        costPrice: 1.4,
        salePrice: 3.2,
        quantity: 30,
        unit: 'pcs',
        isTracked: true,
        image: IMG.pizza,
        warehouseCode: 'WH-DEMO-REST',
        station: 'kitchen',
      },
      {
        sku: 'DEMO-MEAL-GRILL',
        name: 'مشاوي مشكلة',
        nameEn: 'Mixed Grill',
        category: 'وجبات',
        costPrice: 2.2,
        salePrice: 4.9,
        quantity: 25,
        unit: 'pcs',
        isTracked: true,
        image: IMG.grilled,
        warehouseCode: 'WH-DEMO-REST',
        station: 'kitchen',
      },
      {
        sku: 'DEMO-MEAL-SALAD',
        name: 'سلطة يونانية',
        nameEn: 'Greek Salad',
        category: 'سلطات',
        costPrice: 0.6,
        salePrice: 1.5,
        quantity: 35,
        unit: 'pcs',
        isTracked: true,
        image: IMG.salad,
        warehouseCode: 'WH-DEMO-REST',
        station: 'kitchen',
      },
      {
        sku: 'DEMO-DRINK-OJ',
        name: 'عصير برتقال طازج',
        nameEn: 'Fresh Orange Juice',
        category: 'مشروبات',
        costPrice: 0.35,
        salePrice: 0.9,
        quantity: 80,
        unit: 'pcs',
        isTracked: true,
        image: IMG.juice,
        warehouseCode: 'WH-DEMO-CAFE',
        station: 'bar',
      },
      {
        sku: 'DEMO-DRINK-COFFEE',
        name: 'قهوة عربية',
        nameEn: 'Arabic Coffee',
        category: 'مشروبات',
        costPrice: 0.25,
        salePrice: 0.7,
        quantity: 100,
        unit: 'pcs',
        isTracked: true,
        image: IMG.coffee,
        warehouseCode: 'WH-DEMO-CAFE',
        station: 'bar',
      },
      {
        sku: 'DEMO-SWEET-CAKE',
        name: 'كعكة الشوكولاتة',
        nameEn: 'Chocolate Cake',
        category: 'حلويات',
        costPrice: 0.9,
        salePrice: 2.1,
        quantity: 20,
        unit: 'pcs',
        isTracked: true,
        image: IMG.cake,
        warehouseCode: 'WH-DEMO-CAFE',
        station: 'bar',
      },
      {
        sku: 'DEMO-GROC-RICE',
        name: 'أرز بسمتي 5كغ',
        nameEn: 'Basmati Rice 5kg',
        category: 'بقالة',
        costPrice: 2.5,
        salePrice: 3.75,
        quantity: 60,
        unit: 'bag',
        isTracked: true,
        image: IMG.rice,
        warehouseCode: 'WH-DEMO-GROC',
      },
      {
        sku: 'DEMO-GROC-OIL',
        name: 'زيت طبخ 1لتر',
        nameEn: 'Cooking Oil 1L',
        category: 'بقالة',
        costPrice: 0.7,
        salePrice: 1.1,
        quantity: 90,
        unit: 'bottle',
        isTracked: true,
        image: IMG.oil,
        warehouseCode: 'WH-DEMO-GROC',
      },
      {
        sku: 'DEMO-GROC-MILK',
        name: 'حليب طازج',
        nameEn: 'Fresh Milk',
        category: 'ألبان',
        costPrice: 0.4,
        salePrice: 0.65,
        quantity: 70,
        unit: 'pcs',
        isTracked: true,
        image: IMG.milk,
        warehouseCode: 'WH-DEMO-GROC',
      },
      {
        sku: 'DEMO-GROC-CHIPS',
        name: 'شيبس بطاطس',
        nameEn: 'Potato Chips',
        category: 'سناكات',
        costPrice: 0.15,
        salePrice: 0.35,
        quantity: 120,
        unit: 'pcs',
        isTracked: true,
        image: IMG.chips,
        warehouseCode: 'WH-DEMO-GROC',
      },
      {
        sku: 'DEMO-GROC-WATER',
        name: 'ماء معدني',
        nameEn: 'Mineral Water',
        category: 'مشروبات',
        costPrice: 0.08,
        salePrice: 0.2,
        quantity: 200,
        unit: 'pcs',
        isTracked: true,
        image: IMG.water,
        warehouseCode: 'WH-DEMO-GROC',
      },
      {
        sku: 'DEMO-GROC-SOAP',
        name: 'صابون غسيل',
        nameEn: 'Laundry Soap',
        category: 'منظفات',
        costPrice: 0.3,
        salePrice: 0.55,
        quantity: 45,
        unit: 'pcs',
        isTracked: true,
        image: IMG.soap,
        warehouseCode: 'WH-DEMO-GROC',
      },
    ];
  }

  private async upsertProducts(
    companyId: string,
    warehouses: Record<string, { id: string; code: string }>,
  ) {
    const created: Array<{
      id: string;
      sku: string;
      station?: 'kitchen' | 'bar';
    }> = [];

    for (const p of this.catalog()) {
      const wh = warehouses[p.warehouseCode];
      if (!wh) continue;

      const existing = await this.prisma.product.findFirst({
        where: { companyId, sku: p.sku },
      });

      const data = {
        name: p.name,
        nameEn: p.nameEn,
        category: p.category,
        costPrice: new Prisma.Decimal(p.costPrice),
        salePrice: new Prisma.Decimal(p.salePrice),
        quantity: new Prisma.Decimal(p.quantity),
        unit: p.unit,
        isTracked: p.isTracked,
        isActive: true,
        images: [p.image],
        warehouseId: wh.id,
        customFieldsJson: DEMO_TAG as object,
      };

      const product = existing
        ? await this.prisma.product.update({
            where: { id: existing.id },
            data,
          })
        : await this.prisma.product.create({
            data: {
              companyId,
              sku: p.sku,
              barcode: p.sku,
              ...data,
            },
          });

      await this.prisma.warehouseStock.upsert({
        where: {
          productId_warehouseId: {
            productId: product.id,
            warehouseId: wh.id,
          },
        },
        create: {
          productId: product.id,
          warehouseId: wh.id,
          quantity: new Prisma.Decimal(p.quantity),
        },
        update: { quantity: new Prisma.Decimal(p.quantity) },
      });

      created.push({ id: product.id, sku: p.sku, station: p.station });
    }
    return created;
  }

  private async routeStations(
    companyId: string,
    products: Array<{ id: string; station?: 'kitchen' | 'bar' }>,
    stations: {
      kitchen: { id: string };
      bar: { id: string };
    },
  ) {
    for (const p of products) {
      if (!p.station) continue;
      const stationId =
        p.station === 'bar' ? stations.bar.id : stations.kitchen.id;
      await this.prisma.restoProductStation.upsert({
        where: {
          companyId_productId: { companyId, productId: p.id },
        },
        create: { companyId, productId: p.id, stationId },
        update: { stationId },
      });
    }
  }

  private async seedFloorIfEmpty(companyId: string) {
    const tables = await this.prisma.restoTable.count({ where: { companyId } });
    if (tables > 0) return;
    const zone = await this.prisma.restoZone.create({
      data: {
        companyId,
        name: 'الصالة الرئيسية',
        nameEn: 'Main hall',
        sortOrder: 0,
      },
    });
    for (let i = 1; i <= 8; i++) {
      await this.prisma.restoTable.create({
        data: {
          companyId,
          zoneId: zone.id,
          code: `T${i}`,
          name: `طاولة ${i}`,
          seats: i <= 4 ? 4 : 6,
        },
      });
    }
  }
}
