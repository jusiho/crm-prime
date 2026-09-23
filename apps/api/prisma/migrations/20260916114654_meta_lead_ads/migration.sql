-- CreateEnum
CREATE TYPE "MetaLeadStatus" AS ENUM ('PROCESSED', 'NO_PHONE', 'ERROR');

-- CreateTable
CREATE TABLE "meta_pages" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3),
    "sourceId" TEXT,
    "tagIds" JSONB,
    "createDeal" BOOLEAN NOT NULL DEFAULT false,
    "welcomeTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meta_leads" (
    "id" TEXT NOT NULL,
    "leadgenId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "formId" TEXT,
    "formName" TEXT,
    "adId" TEXT,
    "fieldData" JSONB NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "MetaLeadStatus" NOT NULL DEFAULT 'PROCESSED',
    "error" TEXT,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_pages_pageId_key" ON "meta_pages"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_leads_leadgenId_key" ON "meta_leads"("leadgenId");

-- CreateIndex
CREATE INDEX "meta_leads_status_idx" ON "meta_leads"("status");

-- CreateIndex
CREATE INDEX "meta_leads_pageId_idx" ON "meta_leads"("pageId");

-- AddForeignKey
ALTER TABLE "meta_pages" ADD CONSTRAINT "meta_pages_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_pages" ADD CONSTRAINT "meta_pages_welcomeTemplateId_fkey" FOREIGN KEY ("welcomeTemplateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_leads" ADD CONSTRAINT "meta_leads_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "meta_pages"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meta_leads" ADD CONSTRAINT "meta_leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

