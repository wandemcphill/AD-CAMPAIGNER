-- Internal username-first auth
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN "defaultWorkspaceId" TEXT;

UPDATE "User"
SET
  "username" = lower(
    regexp_replace(
      coalesce(nullif(split_part("email", '@', 1), ''), nullif("name", ''), 'user'),
      '[^a-z0-9]+',
      '_',
      'g'
    )
  ) || '_' || substr(replace("id"::text, '-', ''), 1, 8),
  "displayName" = coalesce("displayName", "name")
WHERE "username" IS NULL;

WITH first_workspace AS (
  SELECT DISTINCT ON (tm."userId")
    tm."userId" AS user_id,
    w."id" AS workspace_id
  FROM "TeamMember" tm
  INNER JOIN "Workspace" w ON w."organizationId" = tm."organizationId"
  WHERE tm."deletedAt" IS NULL
    AND w."deletedAt" IS NULL
  ORDER BY tm."userId", w."createdAt" ASC
)
UPDATE "User" u
SET "defaultWorkspaceId" = fw.workspace_id
FROM first_workspace fw
WHERE u."id" = fw.user_id;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_defaultWorkspaceId_idx" ON "User"("defaultWorkspaceId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_defaultWorkspaceId_fkey"
  FOREIGN KEY ("defaultWorkspaceId") REFERENCES "Workspace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
