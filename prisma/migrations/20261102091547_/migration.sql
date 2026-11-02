-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'USER', 'VIEWER');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "sheets_exported_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(500) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reset_token" VARCHAR(255),
    "reset_token_exp" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_reset_token_key" ON "admin_users"("reset_token");

-- CreateIndex
CREATE INDEX "admin_users_username_idx" ON "admin_users"("username");

-- CreateIndex
CREATE INDEX "admin_users_email_idx" ON "admin_users"("email");
