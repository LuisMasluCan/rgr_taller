ALTER TABLE "Quotation"
    ADD COLUMN "vehicleId" TEXT,
    ADD COLUMN "serviceOrderId" TEXT,
    ADD COLUMN "reason" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "mileageIn" INTEGER,
    ADD COLUMN "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN "legacyData" JSONB;

ALTER TABLE "QuotationItem"
    ADD COLUMN "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    ADD COLUMN "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 18,
    ADD COLUMN "legacyData" JSONB;

CREATE UNIQUE INDEX "Quotation_serviceOrderId_key" ON "Quotation"("serviceOrderId");
CREATE INDEX "Quotation_vehicleId_idx" ON "Quotation"("vehicleId");

ALTER TABLE "Quotation"
    ADD CONSTRAINT "Quotation_vehicleId_fkey"
    FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Quotation"
    ADD CONSTRAINT "Quotation_serviceOrderId_fkey"
    FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
