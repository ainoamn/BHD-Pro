import { Prisma } from '@prisma/client';

/**
 * Products that belong to a warehouse sector:
 * - home warehouse = warehouseId, OR
 * - have a WarehouseStock row for that warehouse
 *
 * Used so POS / Restaurants do not pull the entire company catalog.
 */
export function productWhereForWarehouse(
  companyId: string,
  warehouseId: string,
  search?: string,
): Prisma.ProductWhereInput {
  const scope: Prisma.ProductWhereInput = {
    OR: [
      { warehouseId },
      { warehouseStocks: { some: { warehouseId } } },
    ],
  };

  const term = search?.trim();
  if (!term) {
    return { companyId, isActive: true, AND: [scope] };
  }

  return {
    companyId,
    isActive: true,
    AND: [
      scope,
      {
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { nameEn: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { barcode: { contains: term, mode: 'insensitive' } },
        ],
      },
    ],
  };
}
