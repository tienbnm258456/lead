ALTER TABLE "orders" ADD COLUMN "crm_status" VARCHAR(255), ADD COLUMN "crm_status_updated_at" TIMESTAMP(3), ADD COLUMN "crm_status_checked_at" TIMESTAMP(3);
CREATE TABLE "retailcrm_events" (
 "event_id" VARCHAR(500) PRIMARY KEY, "order_id" VARCHAR(100) NOT NULL, "external_id" VARCHAR(100) NOT NULL,
 "status" VARCHAR(255) NOT NULL, "status_updated_at" TIMESTAMP(3) NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0, "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "processed_at" TIMESTAMP(3), "error" TEXT, "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "retailcrm_events_processed_at_next_attempt_at_idx" ON "retailcrm_events"("processed_at", "next_attempt_at");
