BEGIN;

ALTER TABLE "uz_products" RENAME COLUMN "id" TO "source_id";
ALTER TABLE "uz_products" RENAME COLUMN "name" TO "name_vi";
ALTER TABLE "uz_products" RENAME COLUMN "xmlId" TO "xml_id";

ALTER TABLE "uz_products"
    ADD COLUMN "original_name" TEXT,
    ALTER COLUMN "name_vi" DROP NOT NULL,
    DROP CONSTRAINT "uz_products_parentId_fkey",
    DROP CONSTRAINT "uz_products_parent_shape_check",
    DROP COLUMN "type",
    DROP COLUMN "parentId",
    DROP COLUMN "crmName",
    DROP COLUMN "article",
    DROP COLUMN "code",
    DROP COLUMN "folder",
    DROP COLUMN "barcodes",
    DROP COLUMN "images",
    DROP COLUMN "stock",
    DROP COLUMN "cost",
    DROP COLUMN "salePrice",
    DROP COLUMN "dimensionsCm",
    DROP COLUMN "weightKg",
    DROP COLUMN "ikpu",
    DROP COLUMN "packageCode",
    DROP COLUMN "vatPercent",
    DROP COLUMN "otherChannels";

COMMIT;
