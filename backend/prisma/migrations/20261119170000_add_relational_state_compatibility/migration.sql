-- Preserve legacy UI-only fields alongside normalized relational columns.
ALTER TABLE "Customer" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "Vehicle" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "Category" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "Item" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "ServiceOrder" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "ServiceOrderItem" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "ServiceOrderItem" ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 18;
ALTER TABLE "BankAccount" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "CashMovement" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "Supplier" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "Appointment" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "WorkshopAsset" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "CashSession" ADD COLUMN "legacyData" JSONB;
ALTER TABLE "CashSessionMovement" ADD COLUMN "legacyData" JSONB;

CREATE TABLE "WorkshopSettings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "activeProfile" TEXT NOT NULL DEFAULT 'Sin sesión',
    CONSTRAINT "WorkshopSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkshopDataVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "WorkshopDataVersion_pkey" PRIMARY KEY ("id")
);
