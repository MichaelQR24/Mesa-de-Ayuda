-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AiAction" AS ENUM ('CORRECT', 'PARAPHRASE', 'PROFESSIONALIZE', 'SUMMARIZE', 'REPLY');

-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('PROFESSIONAL', 'FORMAL', 'FRIENDLY', 'TECHNICAL', 'CASUAL');

-- CreateEnum
CREATE TYPE "ParaphraseLevel" AS ENUM ('SOFT', 'MEDIUM', 'COMPLETE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_histories" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AiAction" NOT NULL,
    "originalText" TEXT NOT NULL,
    "resultText" TEXT NOT NULL,
    "tone" "Tone" NOT NULL DEFAULT 'PROFESSIONAL',
    "paraphraseLevel" "ParaphraseLevel" NOT NULL DEFAULT 'MEDIUM',
    "model" TEXT NOT NULL DEFAULT 'llama-3.1-8b-instant',
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "library_items_userId_idx" ON "library_items"("userId");

-- CreateIndex
CREATE INDEX "library_items_categoryId_idx" ON "library_items"("categoryId");

-- CreateIndex
CREATE INDEX "library_items_isShared_idx" ON "library_items"("isShared");

-- CreateIndex
CREATE INDEX "library_items_isFavorite_idx" ON "library_items"("isFavorite");

-- CreateIndex
CREATE INDEX "library_items_createdAt_idx" ON "library_items"("createdAt");

-- CreateIndex
CREATE INDEX "ai_histories_createdAt_idx" ON "ai_histories"("createdAt");

-- CreateIndex
CREATE INDEX "ai_histories_userId_idx" ON "ai_histories"("userId");

-- CreateIndex
CREATE INDEX "ai_histories_action_idx" ON "ai_histories"("action");

-- AddForeignKey
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_histories" ADD CONSTRAINT "ai_histories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
