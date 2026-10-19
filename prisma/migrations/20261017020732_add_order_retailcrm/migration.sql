-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('EXPORT', 'PURGE');

-- CreateEnum
CREATE TYPE "OrderSyncStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "leads" (
    "id" SERIAL NOT NULL,
    "fullname" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" VARCHAR(255),
    "note" TEXT,
    "source" VARCHAR(255) NOT NULL DEFAULT 'Landing Page',
    "utm_source" VARCHAR(255),
    "utm_medium" VARCHAR(255),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "exported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_logs" (
    "id" SERIAL NOT NULL,
    "action" "ActionType" NOT NULL,
    "count" INTEGER NOT NULL,
    "note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "customer_name" VARCHAR(255) NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "delivery_city" VARCHAR(255),
    "delivery_address" TEXT NOT NULL,
    "items_json" TEXT NOT NULL,
    "total_price" DECIMAL(12,2) NOT NULL,
    "sync_status" "OrderSyncStatus" NOT NULL DEFAULT 'PENDING',
    "sync_message" TEXT,
    "retailcrm_id" INTEGER,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_source_idx" ON "leads"("source");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_exported_at_idx" ON "leads"("exported_at");

-- CreateIndex
CREATE INDEX "export_logs_action_idx" ON "export_logs"("action");

-- CreateIndex
CREATE INDEX "export_logs_created_at_idx" ON "export_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_external_id_key" ON "orders"("external_id");

-- CreateIndex
CREATE INDEX "orders_sync_status_idx" ON "orders"("sync_status");

-- CreateIndex
CREATE INDEX "orders_external_id_idx" ON "orders"("external_id");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_sync_logs_order_id_idx" ON "order_sync_logs"("order_id");

-- CreateIndex
CREATE INDEX "order_sync_logs_status_idx" ON "order_sync_logs"("status");

-- CreateIndex
CREATE INDEX "order_sync_logs_created_at_idx" ON "order_sync_logs"("created_at");

-- AddForeignKey
ALTER TABLE "order_sync_logs" ADD CONSTRAINT "order_sync_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
