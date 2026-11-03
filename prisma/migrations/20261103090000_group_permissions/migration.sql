-- Existing unassigned data remains visible only to the total admin.
ALTER TYPE "AdminRole" RENAME TO "AdminRole_old";
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'ADMIN2', 'USER');
ALTER TABLE "admin_users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "admin_users" ALTER COLUMN "role" TYPE "AdminRole" USING (CASE WHEN "role"::text = 'VIEWER' THEN 'USER' ELSE "role"::text END)::"AdminRole";
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'ADMIN';
DROP TYPE "AdminRole_old";
CREATE TABLE "AccessGroup" ("id" SERIAL PRIMARY KEY, "name" VARCHAR(100) NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true);
ALTER TABLE "admin_users" ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "created_by_id" INTEGER, ADD COLUMN "group_id" INTEGER REFERENCES "AccessGroup"("id");
ALTER TABLE "products" ADD COLUMN "group_id" INTEGER REFERENCES "AccessGroup"("id");
ALTER TABLE "landing_pages" ADD COLUMN "group_id" INTEGER REFERENCES "AccessGroup"("id"), ADD COLUMN "deleted_at" TIMESTAMP(3), ADD COLUMN "created_by_id" INTEGER;
ALTER TABLE "orders" ADD COLUMN "group_id" INTEGER REFERENCES "AccessGroup"("id"), ADD COLUMN "landing_page_id" INTEGER, ADD COLUMN "created_by_id" INTEGER;
CREATE INDEX "orders_group_id_idx" ON "orders"("group_id");
CREATE INDEX "landing_pages_group_id_idx" ON "landing_pages"("group_id");
CREATE INDEX "admin_users_group_id_idx" ON "admin_users"("group_id");
UPDATE "orders" o SET "landing_page_id" = lp.id FROM "landing_pages" lp JOIN "products" p ON p.id=lp.product_id WHERE o.landing_slug=p.slug;
