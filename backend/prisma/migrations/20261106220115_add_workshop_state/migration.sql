-- CreateTable
CREATE TABLE "WorkshopState" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkshopState_pkey" PRIMARY KEY ("id")
);
