-- Hisaby Restaurants R2/R3: floor, tables, stations, orders, KDS items

CREATE TYPE "RestoTableStatus" AS ENUM ('FREE', 'OCCUPIED', 'BILLING', 'RESERVED');
CREATE TYPE "RestoOrderStatus" AS ENUM ('OPEN', 'SENT', 'PARTIAL', 'READY', 'CLOSED', 'CANCELLED');
CREATE TYPE "RestoOrderItemStatus" AS ENUM ('PENDING', 'SENT', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');
CREATE TYPE "RestoOrderChannel" AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY');

CREATE TABLE "resto_zones" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_zones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resto_tables" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "status" "RestoTableStatus" NOT NULL DEFAULT 'FREE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_tables_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resto_stations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_stations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resto_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "table_id" TEXT,
    "number" TEXT NOT NULL,
    "channel" "RestoOrderChannel" NOT NULL DEFAULT 'DINE_IN',
    "status" "RestoOrderStatus" NOT NULL DEFAULT 'OPEN',
    "guests" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "opened_by_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resto_order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "station_id" TEXT,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,3) NOT NULL,
    "notes" TEXT,
    "status" "RestoOrderItemStatus" NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "resto_zones_company_id_sort_order_idx" ON "resto_zones"("company_id", "sort_order");
CREATE INDEX "resto_tables_company_id_zone_id_sort_order_idx" ON "resto_tables"("company_id", "zone_id", "sort_order");
CREATE INDEX "resto_tables_company_id_status_idx" ON "resto_tables"("company_id", "status");
CREATE UNIQUE INDEX "resto_tables_company_id_code_key" ON "resto_tables"("company_id", "code");
CREATE INDEX "resto_stations_company_id_sort_order_idx" ON "resto_stations"("company_id", "sort_order");
CREATE UNIQUE INDEX "resto_orders_company_id_number_key" ON "resto_orders"("company_id", "number");
CREATE INDEX "resto_orders_company_id_status_created_at_idx" ON "resto_orders"("company_id", "status", "created_at");
CREATE INDEX "resto_orders_company_id_table_id_idx" ON "resto_orders"("company_id", "table_id");
CREATE INDEX "resto_order_items_order_id_status_idx" ON "resto_order_items"("order_id", "status");
CREATE INDEX "resto_order_items_station_id_status_idx" ON "resto_order_items"("station_id", "status");

ALTER TABLE "resto_zones" ADD CONSTRAINT "resto_zones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_tables" ADD CONSTRAINT "resto_tables_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_tables" ADD CONSTRAINT "resto_tables_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "resto_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_stations" ADD CONSTRAINT "resto_stations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_orders" ADD CONSTRAINT "resto_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_orders" ADD CONSTRAINT "resto_orders_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "resto_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resto_orders" ADD CONSTRAINT "resto_orders_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resto_order_items" ADD CONSTRAINT "resto_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "resto_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_order_items" ADD CONSTRAINT "resto_order_items_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "resto_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
