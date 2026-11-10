CREATE TABLE "uz_products" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "parentId" UUID,
    "name" TEXT NOT NULL,
    "crmName" TEXT,
    "article" TEXT,
    "code" TEXT,
    "folder" TEXT,
    "barcodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "images" JSONB NOT NULL,
    "stock" JSONB NOT NULL,
    "cost" DECIMAL(18,2),
    "salePrice" DECIMAL(18,2),
    "dimensionsCm" JSONB NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "ikpu" TEXT,
    "packageCode" TEXT,
    "vatPercent" DOUBLE PRECISION,
    "otherChannels" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "uz_products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uz_products_parent_shape_check" CHECK (
        ("type" = 'product' AND "parentId" IS NULL)
        OR ("type" = 'variant' AND "parentId" IS NOT NULL AND "parentId" <> "id")
    )
);

CREATE INDEX "uz_products_parentId_idx" ON "uz_products"("parentId");
ALTER TABLE "uz_products" ADD CONSTRAINT "uz_products_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "uz_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
