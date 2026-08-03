-- Phase 3: Read-only Supabase exposure for intentionally public catalogs/listings.
-- These are the only Prisma tables with Supabase client SELECT grants. No client write policies are created.

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_role);
    END IF;
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public."MarketplaceAgency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."MarketplaceCreator" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VoucherProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."GiftCardProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VtuDataPlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."NumberCountry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public."VirtualNumberProduct" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.digital_access_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.digital_access_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.digital_access_plans ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "MarketplaceAgency_public_rls_idx" ON public."MarketplaceAgency" ("isActive", "deletedAt");
CREATE INDEX IF NOT EXISTS "MarketplaceCreator_public_rls_idx" ON public."MarketplaceCreator" ("isActive", "deletedAt");
CREATE INDEX IF NOT EXISTS "VoucherProduct_public_rls_idx" ON public."VoucherProduct" ("active");
DO $$
BEGIN
  IF to_regclass('public."GiftCardProduct"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "GiftCardProduct_public_rls_idx" ON public."GiftCardProduct" ("active");
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "VtuDataPlan_public_rls_idx" ON public."VtuDataPlan" ("active", "network");
CREATE INDEX IF NOT EXISTS "NumberCountry_public_rls_idx" ON public."NumberCountry" ("enabled", "sortOrder");
CREATE INDEX IF NOT EXISTS "VirtualNumberProduct_public_rls_idx" ON public."VirtualNumberProduct" ("active", "countryCode");
CREATE INDEX IF NOT EXISTS "digital_access_categories_public_rls_idx" ON public.digital_access_categories ("is_active", "deleted_at", "sort_order");
CREATE INDEX IF NOT EXISTS "digital_access_services_public_rls_idx" ON public.digital_access_services ("is_active", "deleted_at", "category");
CREATE INDEX IF NOT EXISTS "digital_access_plans_public_rls_idx" ON public.digital_access_plans ("is_active", "deleted_at", "service_id");

DROP POLICY IF EXISTS "MarketplaceAgency_public_select" ON public."MarketplaceAgency";
CREATE POLICY "MarketplaceAgency_public_select" ON public."MarketplaceAgency"
  FOR SELECT
  TO PUBLIC
  USING ("isActive" = true AND "deletedAt" IS NULL);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public."MarketplaceAgency" TO %I', app_role);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "MarketplaceCreator_public_select" ON public."MarketplaceCreator";
CREATE POLICY "MarketplaceCreator_public_select" ON public."MarketplaceCreator"
  FOR SELECT
  TO PUBLIC
  USING ("isActive" = true AND "deletedAt" IS NULL);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public."MarketplaceCreator" TO %I', app_role);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "VoucherProduct_public_select" ON public."VoucherProduct";
CREATE POLICY "VoucherProduct_public_select" ON public."VoucherProduct"
  FOR SELECT
  TO PUBLIC
  USING ("active" = true);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public."VoucherProduct" TO %I', app_role);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  app_role text;
BEGIN
  IF to_regclass('public."GiftCardProduct"') IS NOT NULL THEN
    DROP POLICY IF EXISTS "GiftCardProduct_public_select" ON public."GiftCardProduct";
    CREATE POLICY "GiftCardProduct_public_select" ON public."GiftCardProduct"
      FOR SELECT
      TO PUBLIC
      USING ("active" = true);

    FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
        EXECUTE format('GRANT SELECT ON TABLE public."GiftCardProduct" TO %I', app_role);
      END IF;
    END LOOP;
  END IF;
END $$;

DROP POLICY IF EXISTS "VtuDataPlan_public_select" ON public."VtuDataPlan";
CREATE POLICY "VtuDataPlan_public_select" ON public."VtuDataPlan"
  FOR SELECT
  TO PUBLIC
  USING ("active" = true);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public."VtuDataPlan" TO %I', app_role);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "NumberCountry_public_select" ON public."NumberCountry";
CREATE POLICY "NumberCountry_public_select" ON public."NumberCountry"
  FOR SELECT
  TO PUBLIC
  USING ("enabled" = true);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public."NumberCountry" TO %I', app_role);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "VirtualNumberProduct_public_select" ON public."VirtualNumberProduct";
CREATE POLICY "VirtualNumberProduct_public_select" ON public."VirtualNumberProduct"
  FOR SELECT
  TO PUBLIC
  USING ("active" = true);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public."VirtualNumberProduct" TO %I', app_role);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "digital_access_categories_public_select" ON public.digital_access_categories;
CREATE POLICY "digital_access_categories_public_select" ON public.digital_access_categories
  FOR SELECT
  TO PUBLIC
  USING ("is_active" = true AND "deleted_at" IS NULL);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.digital_access_categories TO %I', app_role);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "digital_access_services_public_select" ON public.digital_access_services;
CREATE POLICY "digital_access_services_public_select" ON public.digital_access_services
  FOR SELECT
  TO PUBLIC
  USING ("is_active" = true AND "deleted_at" IS NULL);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.digital_access_services TO %I', app_role);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "digital_access_plans_public_select" ON public.digital_access_plans;
CREATE POLICY "digital_access_plans_public_select" ON public.digital_access_plans
  FOR SELECT
  TO PUBLIC
  USING ("is_active" = true AND "deleted_at" IS NULL);

DO $$
DECLARE
  app_role text;
BEGIN
  FOREACH app_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
      EXECUTE format('GRANT SELECT ON TABLE public.digital_access_plans TO %I', app_role);
    END IF;
  END LOOP;
END $$;
