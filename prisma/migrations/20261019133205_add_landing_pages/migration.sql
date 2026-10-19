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

-- CreateIndex
CREATE UNIQUE INDEX "landing_pages_api_key_key" ON "landing_pages"("api_key");

-- CreateIndex
CREATE INDEX "landing_pages_api_key_idx" ON "landing_pages"("api_key");

-- CreateIndex
CREATE INDEX "landing_pages_product_id_idx" ON "landing_pages"("product_id");

-- CreateIndex
CREATE INDEX "landing_pages_active_idx" ON "landing_pages"("active");

-- AddForeignKey
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
