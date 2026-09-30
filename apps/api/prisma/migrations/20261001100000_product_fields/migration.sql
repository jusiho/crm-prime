-- Campos personalizados de producto: definiciones por empresa y valores en
-- cada producto.

ALTER TABLE "products" ADD COLUMN "attributes" JSONB;

CREATE TABLE "product_fields" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'text',
  "options" TEXT[],
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_fields_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_fields_orgId_key_key" ON "product_fields"("orgId", "key");

ALTER TABLE "product_fields" ADD CONSTRAINT "product_fields_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Aislamiento por empresa, como el resto de tablas con orgId.
ALTER TABLE "product_fields" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_fields_tenant_isolation" ON "product_fields"
  USING (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  )
  WITH CHECK (
    current_setting('app.current_org', true) = '*'
    OR "orgId" = current_setting('app.current_org', true)
  );
