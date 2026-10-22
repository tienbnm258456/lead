-- AlterTable: Mở rộng cột selected_package và selected_size
-- để chứa nhiều giá trị checkbox từ LadiPage form

-- selected_package: VarChar(500) → Text (không giới hạn)
ALTER TABLE "orders" ALTER COLUMN "selected_package" TYPE TEXT;

-- selected_size: VarChar(50) → VarChar(500)
ALTER TABLE "orders" ALTER COLUMN "selected_size" TYPE VARCHAR(500);
