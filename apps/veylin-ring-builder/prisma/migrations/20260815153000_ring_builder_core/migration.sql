CREATE TABLE "NivodaCache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "DiamondVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "diamondId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "NivodaOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "nivodaOrderId" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "NivodaCache_expiresAt_idx" ON "NivodaCache"("expiresAt");
CREATE INDEX "DiamondVariant_shop_expiresAt_idx" ON "DiamondVariant"("shop", "expiresAt");
CREATE UNIQUE INDEX "DiamondVariant_shop_offerId_key" ON "DiamondVariant"("shop", "offerId");
CREATE INDEX "NivodaOrder_shop_status_idx" ON "NivodaOrder"("shop", "status");
CREATE UNIQUE INDEX "NivodaOrder_shop_shopifyOrderId_offerId_key" ON "NivodaOrder"("shop", "shopifyOrderId", "offerId");
