-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TemplateStatus" ADD VALUE 'IN_APPEAL';
ALTER TYPE "TemplateStatus" ADD VALUE 'PENDING_DELETION';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "buttonPayload" TEXT,
ADD COLUMN     "interactive" JSONB;

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "buttons" JSONB,
ADD COLUMN     "category" "TemplateCategory" NOT NULL DEFAULT 'MARKETING',
ADD COLUMN     "footer" TEXT,
ADD COLUMN     "header" JSONB,
ADD COLUMN     "readOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "wabaId" TEXT;

-- AlterTable
ALTER TABLE "webhook_subscriptions" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "quick_replies" (
    "id" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaType" "MessageType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quick_replies_shortcut_key" ON "quick_replies"("shortcut");

-- CreateIndex
CREATE UNIQUE INDEX "templates_name_language_key" ON "templates"("name", "language");

