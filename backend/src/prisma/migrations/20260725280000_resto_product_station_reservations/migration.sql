-- Product→station routing + reservations

CREATE TYPE "RestoReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE "resto_product_stations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "station_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_product_stations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resto_reservations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "table_id" TEXT,
    "guest_name" TEXT NOT NULL,
    "phone" TEXT,
    "guests" INTEGER NOT NULL DEFAULT 2,
    "reserved_at" TIMESTAMP(3) NOT NULL,
    "status" "RestoReservationStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "resto_product_stations_company_id_product_id_key" ON "resto_product_stations"("company_id", "product_id");
CREATE INDEX "resto_product_stations_company_id_station_id_idx" ON "resto_product_stations"("company_id", "station_id");
CREATE INDEX "resto_reservations_company_id_reserved_at_idx" ON "resto_reservations"("company_id", "reserved_at");
CREATE INDEX "resto_reservations_company_id_status_idx" ON "resto_reservations"("company_id", "status");

ALTER TABLE "resto_product_stations" ADD CONSTRAINT "resto_product_stations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_product_stations" ADD CONSTRAINT "resto_product_stations_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "resto_stations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_reservations" ADD CONSTRAINT "resto_reservations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resto_reservations" ADD CONSTRAINT "resto_reservations_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "resto_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
