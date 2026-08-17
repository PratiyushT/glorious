ALTER TABLE "ShopConfiguration" ADD COLUMN "supplierOrderPolicy" TEXT NOT NULL DEFAULT 'review';

ALTER TABLE "NivodaOrder" ADD COLUMN "orderPolicy" TEXT NOT NULL DEFAULT 'review';
ALTER TABLE "NivodaOrder" ADD COLUMN "provider" TEXT;
ALTER TABLE "NivodaOrder" ADD COLUMN "providerOrderId" TEXT;
ALTER TABLE "NivodaOrder" ADD COLUMN "providerStatus" TEXT;
ALTER TABLE "NivodaOrder" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "NivodaOrder" ADD COLUMN "isFixture" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "NivodaOrder" ADD COLUMN "lastAttemptAt" DATETIME;
ALTER TABLE "NivodaOrder" ADD COLUMN "submittedAt" DATETIME;

UPDATE "NivodaOrder"
SET "providerOrderId" = "nivodaOrderId",
    "provider" = CASE WHEN "nivodaOrderId" IS NULL THEN NULL ELSE 'nivoda_diamond_api' END
WHERE "providerOrderId" IS NULL;

CREATE UNIQUE INDEX "NivodaOrder_idempotencyKey_key" ON "NivodaOrder"("idempotencyKey");
