import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      // The integration flow exercises in-memory service logic only; the Prisma
      // client must construct but never connects, so a placeholder URL suffices.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://placeholder:placeholder@localhost:5432/placeholder"
    }
  }
});
