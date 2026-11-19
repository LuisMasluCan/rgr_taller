-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('COMPANY', 'PERSON');

-- CreateEnum
CREATE TYPE "CashCurrency" AS ENUM ('PEN', 'USD');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "type" "SupplierType" NOT NULL,
    "name" TEXT NOT NULL,
    "identification" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "observations" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "observations" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "WorkshopAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "openedAt" TIMESTAMPTZ(6) NOT NULL,
    "closedAt" TIMESTAMPTZ(6),
    "closedBy" TEXT,
    "status" "CashSessionStatus" NOT NULL,
    "initialAmount" DECIMAL(10,2) NOT NULL,
    "totalIncomes" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalExpenses" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expectedBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "actualBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "difference" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "initialAmountUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalIncomesUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalExpensesUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expectedBalanceUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "actualBalanceUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "differenceUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "openingObservations" TEXT,
    "observations" TEXT,
    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSessionMovement" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" "CashCurrency" NOT NULL,
    "paymentMethod" "PaymentMethod",
    "expenseCategory" TEXT,
    "orderId" TEXT,
    "contact" TEXT,
    "timestamp" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "CashSessionMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");
CREATE INDEX "Supplier_identification_idx" ON "Supplier"("identification");
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");
CREATE INDEX "Appointment_vehicleId_idx" ON "Appointment"("vehicleId");
CREATE INDEX "Appointment_date_time_idx" ON "Appointment"("date", "time");
CREATE INDEX "WorkshopAsset_reference_idx" ON "WorkshopAsset"("reference");
CREATE INDEX "CashSession_status_openedAt_idx" ON "CashSession"("status", "openedAt");
CREATE INDEX "CashSessionMovement_sessionId_idx" ON "CashSessionMovement"("sessionId");
CREATE INDEX "CashSessionMovement_timestamp_idx" ON "CashSessionMovement"("timestamp");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashSessionMovement" ADD CONSTRAINT "CashSessionMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
