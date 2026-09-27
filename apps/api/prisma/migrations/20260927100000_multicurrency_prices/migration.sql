-- Precios multimoneda: precio explícito por moneda para cada producto, y una
-- moneda opcional fijada a mano en el contacto (si no, se usa la de su país).

ALTER TABLE "contacts" ADD COLUMN "currency" TEXT;

CREATE TABLE "product_prices" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_prices_productId_currency_key" ON "product_prices"("productId", "currency");
CREATE INDEX "product_prices_orgId_idx" ON "product_prices"("orgId");

ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aislamiento por empresa, como el resto de tablas con orgId.
ALTER TABLE "product_prices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_prices_tenant_isolation" ON "product_prices"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );
