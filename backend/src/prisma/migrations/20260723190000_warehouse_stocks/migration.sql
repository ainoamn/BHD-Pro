-- Per-warehouse stock quantities (Product.quantity remains company-wide sum)

CREATE TABLE "warehouse_stocks" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_stocks_pkey" PRIMARY KEY ("id")
);

-- Ensure every company with tracked products has at least one active warehouse (MAIN)
INSERT INTO "warehouses" ("id", "company_id", "name", "code", "is_active", "created_at")
SELECT gen_random_uuid()::text, c.id, 'المستودع الرئيسي', 'MAIN', true, CURRENT_TIMESTAMP
FROM "companies" c
WHERE EXISTS (
    SELECT 1 FROM "products" p WHERE p.company_id = c.id AND p.is_tracked = true
)
AND NOT EXISTS (
    SELECT 1 FROM "warehouses" w WHERE w.company_id = c.id AND w.is_active = true
);

-- Backfill: assign existing product qty to product.warehouse_id or oldest active warehouse
INSERT INTO "warehouse_stocks" ("id", "product_id", "warehouse_id", "quantity", "updated_at")
SELECT
    gen_random_uuid()::text,
    p.id,
    COALESCE(p.warehouse_id, w.id),
    p.quantity,
    CURRENT_TIMESTAMP
FROM "products" p
JOIN LATERAL (
    SELECT id FROM "warehouses"
    WHERE company_id = p.company_id AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1
) w ON true
WHERE p.is_tracked = true
  AND NOT EXISTS (
    SELECT 1 FROM "warehouse_stocks" ws
    WHERE ws.product_id = p.id
      AND ws.warehouse_id = COALESCE(p.warehouse_id, w.id)
  );

CREATE UNIQUE INDEX "warehouse_stocks_product_id_warehouse_id_key"
  ON "warehouse_stocks"("product_id", "warehouse_id");

CREATE INDEX "warehouse_stocks_warehouse_id_idx"
  ON "warehouse_stocks"("warehouse_id");

ALTER TABLE "warehouse_stocks"
  ADD CONSTRAINT "warehouse_stocks_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_stocks"
  ADD CONSTRAINT "warehouse_stocks_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
