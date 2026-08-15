-- Tenant-scope FX quotes. Nullable so existing rows (all admin-created, since
-- the quote route has always required admin:access) remain valid; ownership is
-- enforced only where the column is set.
ALTER TABLE "FxQuote" ADD COLUMN "workspaceId" TEXT;

CREATE INDEX "FxQuote_workspaceId_idx" ON "FxQuote"("workspaceId");
