import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.PRISMA_MIGRATE_DATABASE_URL ??
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://fliptrybe:fliptrybe@localhost:5432/fliptrybe_ads"
  }
});
