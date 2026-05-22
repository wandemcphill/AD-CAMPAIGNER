-- CreateEnum
CREATE TYPE "DigitalAccessRequestStatus" AS ENUM ('pending', 'processing', 'fulfilled', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "DigitalAccessWalletChargeStatus" AS ENUM ('CHARGED', 'REFUNDED', 'FAILED');

-- CreateTable
CREATE TABLE "digital_access_categories" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 100,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "digital_access_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_access_services" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "starting_price" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "delivery_eta" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "is_featured" BOOLEAN NOT NULL DEFAULT false,
  "thumbnail" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "digital_access_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_access_plans" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "plan_name" TEXT NOT NULL,
  "duration" TEXT NOT NULL,
  "price" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "description" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "digital_access_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_access_requests" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "user_id" TEXT,
  "service_id" TEXT NOT NULL,
  "plan_id" TEXT NOT NULL,
  "contact_type" TEXT NOT NULL,
  "contact_value" TEXT NOT NULL,
  "notes" TEXT,
  "status" "DigitalAccessRequestStatus" NOT NULL DEFAULT 'pending',
  "assigned_to" TEXT,
  "amount_minor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "idempotency_key" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "digital_access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_access_wallet_charges" (
  "id" TEXT NOT NULL,
  "workspace_id" TEXT NOT NULL,
  "wallet_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "DigitalAccessWalletChargeStatus" NOT NULL DEFAULT 'CHARGED',
  "debit_ledger_entry_id" TEXT,
  "refund_ledger_entry_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "digital_access_wallet_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "digital_access_categories_slug_key" ON "digital_access_categories"("slug");
CREATE INDEX "digital_access_categories_is_active_sort_order_idx" ON "digital_access_categories"("is_active", "sort_order");
CREATE INDEX "digital_access_categories_deleted_at_idx" ON "digital_access_categories"("deleted_at");
CREATE UNIQUE INDEX "digital_access_services_slug_key" ON "digital_access_services"("slug");
CREATE INDEX "digital_access_services_category_is_active_idx" ON "digital_access_services"("category", "is_active");
CREATE INDEX "digital_access_services_is_featured_is_active_idx" ON "digital_access_services"("is_featured", "is_active");
CREATE INDEX "digital_access_services_deleted_at_idx" ON "digital_access_services"("deleted_at");
CREATE INDEX "digital_access_plans_service_id_is_active_idx" ON "digital_access_plans"("service_id", "is_active");
CREATE INDEX "digital_access_plans_deleted_at_idx" ON "digital_access_plans"("deleted_at");
CREATE UNIQUE INDEX "digital_access_requests_idempotency_key_key" ON "digital_access_requests"("idempotency_key");
CREATE INDEX "digital_access_requests_workspace_id_status_created_at_idx" ON "digital_access_requests"("workspace_id", "status", "created_at");
CREATE INDEX "digital_access_requests_user_id_created_at_idx" ON "digital_access_requests"("user_id", "created_at");
CREATE INDEX "digital_access_requests_service_id_status_idx" ON "digital_access_requests"("service_id", "status");
CREATE INDEX "digital_access_requests_plan_id_idx" ON "digital_access_requests"("plan_id");
CREATE INDEX "digital_access_requests_deleted_at_idx" ON "digital_access_requests"("deleted_at");
CREATE UNIQUE INDEX "digital_access_wallet_charges_idempotency_key_key" ON "digital_access_wallet_charges"("idempotency_key");
CREATE UNIQUE INDEX "digital_access_wallet_charges_workspace_id_request_id_key" ON "digital_access_wallet_charges"("workspace_id", "request_id");
CREATE INDEX "digital_access_wallet_charges_workspace_id_status_created_at_idx" ON "digital_access_wallet_charges"("workspace_id", "status", "created_at");
CREATE INDEX "digital_access_wallet_charges_wallet_id_created_at_idx" ON "digital_access_wallet_charges"("wallet_id", "created_at");

-- AddForeignKey
ALTER TABLE "digital_access_services" ADD CONSTRAINT "digital_access_services_category_fkey" FOREIGN KEY ("category") REFERENCES "digital_access_categories"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "digital_access_plans" ADD CONSTRAINT "digital_access_plans_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "digital_access_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "digital_access_requests" ADD CONSTRAINT "digital_access_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "digital_access_requests" ADD CONSTRAINT "digital_access_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "digital_access_requests" ADD CONSTRAINT "digital_access_requests_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "digital_access_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "digital_access_requests" ADD CONSTRAINT "digital_access_requests_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "digital_access_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "digital_access_wallet_charges" ADD CONSTRAINT "digital_access_wallet_charges_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "digital_access_wallet_charges" ADD CONSTRAINT "digital_access_wallet_charges_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "digital_access_wallet_charges" ADD CONSTRAINT "digital_access_wallet_charges_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "digital_access_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed inactive editable catalog drafts.
INSERT INTO "digital_access_categories" ("id", "name", "slug", "description", "sort_order", "is_active", "updated_at")
VALUES
  ('dacat_ai_creator_tools', 'AI & Creator Tools', 'ai-creator-tools', 'Premium productivity and creator software access requests.', 10, true, CURRENT_TIMESTAMP),
  ('dacat_streaming_entertainment', 'Streaming & Entertainment', 'streaming-entertainment', 'Entertainment access plans fulfilled by FlipTrybe operations.', 20, true, CURRENT_TIMESTAMP),
  ('dacat_gaming_coins', 'Gaming & Coins', 'gaming-coins', 'Gaming coins, topups, and subscription request workflows.', 30, true, CURRENT_TIMESTAMP),
  ('dacat_infrastructure', 'Infrastructure', 'infrastructure', 'VPN, virtual number, and infrastructure access requests.', 40, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "digital_access_services" ("id", "name", "category", "slug", "description", "starting_price", "currency", "delivery_eta", "is_active", "is_featured", "updated_at")
VALUES
  ('dasvc_chatgpt', 'ChatGPT', 'ai-creator-tools', 'chatgpt', 'AI productivity access for research, writing, and creator workflows.', 0, 'NGN', '5-30 mins', false, true, CURRENT_TIMESTAMP),
  ('dasvc_gemini', 'Gemini', 'ai-creator-tools', 'gemini', 'AI workspace access for creative and operational teams.', 0, 'NGN', '5-30 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_canva_pro', 'Canva Pro', 'ai-creator-tools', 'canva-pro', 'Design access for creators, sellers, and campaign teams.', 0, 'NGN', '10-45 mins', false, true, CURRENT_TIMESTAMP),
  ('dasvc_capcut_pro', 'CapCut Pro', 'ai-creator-tools', 'capcut-pro', 'Creator video editing access request workflow.', 0, 'NGN', '10-45 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_netflix', 'Netflix', 'streaming-entertainment', 'netflix', 'Entertainment access request handled by FlipTrybe support.', 0, 'NGN', '15-60 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_amazon_prime', 'Amazon Prime', 'streaming-entertainment', 'amazon-prime', 'Streaming and entertainment access request.', 0, 'NGN', '15-60 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_crunchyroll', 'Crunchyroll', 'streaming-entertainment', 'crunchyroll', 'Anime streaming access request for entertainment customers.', 0, 'NGN', '15-60 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_spotify', 'Spotify', 'streaming-entertainment', 'spotify', 'Music access request with manual fulfillment tracking.', 0, 'NGN', '10-45 mins', false, true, CURRENT_TIMESTAMP),
  ('dasvc_fc26_coins', 'FC26 Coins', 'gaming-coins', 'fc26-coins', 'Game coin request workflow with admin fulfillment queue.', 0, 'NGN', '30-120 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_game_topups', 'Game Topups', 'gaming-coins', 'game-topups', 'Topup requests for supported games and creator communities.', 0, 'NGN', '30-120 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_gaming_subscriptions', 'Gaming Subscriptions', 'gaming-coins', 'gaming-subscriptions', 'Gaming subscription access requests.', 0, 'NGN', '30-120 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_vpns', 'VPNs', 'infrastructure', 'vpns', 'VPN access requests for secure creator and business workflows.', 0, 'NGN', '10-60 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_otp_services', 'OTP Services', 'infrastructure', 'otp-services', 'Manual infrastructure access request without automated OTP routing.', 0, 'NGN', '10-60 mins', false, false, CURRENT_TIMESTAMP),
  ('dasvc_virtual_numbers', 'Virtual Numbers', 'infrastructure', 'virtual-numbers', 'Virtual number access requests fulfilled by operations.', 0, 'NGN', '10-60 mins', false, false, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "digital_access_plans" ("id", "service_id", "plan_name", "duration", "price", "currency", "description", "is_active", "updated_at")
SELECT service_id || '_starter', service_id, 'Starter Access', '1 month', 0, 'NGN', 'Owner-priced starter plan.', false, CURRENT_TIMESTAMP
FROM (VALUES
  ('dasvc_chatgpt'), ('dasvc_gemini'), ('dasvc_canva_pro'), ('dasvc_capcut_pro'),
  ('dasvc_netflix'), ('dasvc_amazon_prime'), ('dasvc_crunchyroll'), ('dasvc_spotify'),
  ('dasvc_fc26_coins'), ('dasvc_game_topups'), ('dasvc_gaming_subscriptions'),
  ('dasvc_vpns'), ('dasvc_otp_services'), ('dasvc_virtual_numbers')
) AS services(service_id)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "digital_access_plans" ("id", "service_id", "plan_name", "duration", "price", "currency", "description", "is_active", "updated_at")
SELECT service_id || '_extended', service_id, 'Extended Access', '3 months', 0, 'NGN', 'Owner-priced extended plan.', false, CURRENT_TIMESTAMP
FROM (VALUES
  ('dasvc_chatgpt'), ('dasvc_gemini'), ('dasvc_canva_pro'), ('dasvc_capcut_pro'),
  ('dasvc_netflix'), ('dasvc_amazon_prime'), ('dasvc_crunchyroll'), ('dasvc_spotify'),
  ('dasvc_fc26_coins'), ('dasvc_game_topups'), ('dasvc_gaming_subscriptions'),
  ('dasvc_vpns'), ('dasvc_otp_services'), ('dasvc_virtual_numbers')
) AS services(service_id)
ON CONFLICT ("id") DO NOTHING;
