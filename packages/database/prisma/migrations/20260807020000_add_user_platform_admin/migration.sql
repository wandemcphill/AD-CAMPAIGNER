-- Decouples the "admin:access" permission from the OWNER/ADMIN workspace roles.
-- Previously every self-registered user became OWNER of their own new workspace,
-- and OWNER carried admin:access by default — meaning any signup (including via
-- the public customer web app) could authenticate against the admin console's
-- API. isPlatformAdmin is now the sole source of truth for admin:access; it is
-- never granted by registration and must be set explicitly (see
-- PLATFORM_ADMIN_USERNAMES in apps/api/src/modules/auth-session.service.ts).

ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;
