CREATE TABLE "ShopConfiguration" (
    "shop" TEXT NOT NULL PRIMARY KEY,
    "settingCollectionId" TEXT,
    "settingCollectionTitle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
