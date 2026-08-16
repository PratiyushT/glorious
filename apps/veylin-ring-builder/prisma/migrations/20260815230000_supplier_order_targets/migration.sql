ALTER TABLE "ShopConfiguration" ADD COLUMN "supplierOrderTarget" TEXT NOT NULL DEFAULT 'diamond_only';

ALTER TABLE "NivodaOrder" ADD COLUMN "orderTarget" TEXT NOT NULL DEFAULT 'diamond_only';
ALTER TABLE "NivodaOrder" ADD COLUMN "bundleId" TEXT;
ALTER TABLE "NivodaOrder" ADD COLUMN "settingProductId" TEXT;
ALTER TABLE "NivodaOrder" ADD COLUMN "settingVariantId" TEXT;
ALTER TABLE "NivodaOrder" ADD COLUMN "snapshot" TEXT;
ALTER TABLE "NivodaOrder" ADD COLUMN "reviewReason" TEXT;

CREATE INDEX "NivodaOrder_shop_orderTarget_status_idx" ON "NivodaOrder"("shop", "orderTarget", "status");
