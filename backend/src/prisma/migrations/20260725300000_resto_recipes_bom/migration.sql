-- Restaurant recipes (BOM) for ingredient deduct on paid close
CREATE TABLE IF NOT EXISTS "resto_recipes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resto_recipes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "resto_recipe_items" (
    "id" TEXT NOT NULL,
    "recipe_id" TEXT NOT NULL,
    "component_product_id" TEXT NOT NULL,
    "qty" DECIMAL(14,3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "resto_recipe_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resto_recipes_company_id_product_id_key" ON "resto_recipes"("company_id", "product_id");
CREATE UNIQUE INDEX IF NOT EXISTS "resto_recipes_product_id_key" ON "resto_recipes"("product_id");
CREATE INDEX IF NOT EXISTS "resto_recipes_company_id_idx" ON "resto_recipes"("company_id");

CREATE UNIQUE INDEX IF NOT EXISTS "resto_recipe_items_recipe_id_component_product_id_key" ON "resto_recipe_items"("recipe_id", "component_product_id");
CREATE INDEX IF NOT EXISTS "resto_recipe_items_component_product_id_idx" ON "resto_recipe_items"("component_product_id");

DO $$ BEGIN
  ALTER TABLE "resto_recipes"
    ADD CONSTRAINT "resto_recipes_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "resto_recipes"
    ADD CONSTRAINT "resto_recipes_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "resto_recipe_items"
    ADD CONSTRAINT "resto_recipe_items_recipe_id_fkey"
    FOREIGN KEY ("recipe_id") REFERENCES "resto_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "resto_recipe_items"
    ADD CONSTRAINT "resto_recipe_items_component_product_id_fkey"
    FOREIGN KEY ("component_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
