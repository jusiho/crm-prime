-- Webhooks salientes: suscripciones a eventos del CRM.
CREATE TABLE IF NOT EXISTS "webhook_subscriptions" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "events" TEXT[],
  "secret" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastStatus" INTEGER,
  "lastError" TEXT,
  "lastDeliveryAt" TIMESTAMP(3),
  "deliveredCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "webhook_subscriptions_isActive_idx" ON "webhook_subscriptions"("isActive");
