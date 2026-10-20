-- CreateEnum
CREATE TYPE "OrderSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('EXPORT', 'PURGE');

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "xml_id" VARCHAR(255),
    "has_sizes" BOOLEAN NOT NULL DEFAULT false,
    "sizes" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "label" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL,
    "delivery_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "size" VARCHAR(50),
    "xml_id" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_pages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "api_key" VARCHAR(100) NOT NULL,
    "product_id" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "delivery_address" TEXT NOT NULL,
    "items_json" TEXT NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "source" VARCHAR(100) NOT NULL DEFAULT 'ladipage',
    "landing_slug" VARCHAR(100),
    "selected_package" VARCHAR(500),
    "selected_size" VARCHAR(50),
    "sync_status" "OrderSyncStatus" NOT NULL DEFAULT 'PENDING',
    "sync_message" TEXT,
    "retailcrm_id" INTEGER,
    "synced_at" TIMESTAMP(3),
    "exported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" SERIAL NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "count" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sync_logs" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "status" "OrderSyncStatus" NOT NULL,
    "http_status" INTEGER,
    "request_payload" TEXT,
    "response_body" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" VARCHAR(500) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_active_idx" ON "products"("active");

-- CreateIndex
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "landing_pages_api_key_key" ON "landing_pages"("api_key");

-- CreateIndex
CREATE INDEX "landing_pages_api_key_idx" ON "landing_pages"("api_key");

-- CreateIndex
CREATE INDEX "landing_pages_product_id_idx" ON "landing_pages"("product_id");

-- CreateIndex
CREATE INDEX "landing_pages_active_idx" ON "landing_pages"("active");

-- CreateIndex
CREATE UNIQUE INDEX "orders_external_id_key" ON "orders"("external_id");

-- CreateIndex
CREATE INDEX "orders_sync_status_idx" ON "orders"("sync_status");

-- CreateIndex
CREATE INDEX "orders_external_id_idx" ON "orders"("external_id");

-- CreateIndex
CREATE INDEX "orders_source_idx" ON "orders"("source");

-- CreateIndex
CREATE INDEX "orders_landing_slug_idx" ON "orders"("landing_slug");

-- CreateIndex
CREATE INDEX "orders_exported_at_idx" ON "orders"("exported_at");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- CreateIndex
CREATE INDEX "order_sync_logs_order_id_idx" ON "order_sync_logs"("order_id");

-- CreateIndex
CREATE INDEX "order_sync_logs_status_idx" ON "order_sync_logs"("status");

-- CreateIndex
CREATE INDEX "order_sync_logs_created_at_idx" ON "order_sync_logs"("created_at");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sync_logs" ADD CONSTRAINT "order_sync_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
