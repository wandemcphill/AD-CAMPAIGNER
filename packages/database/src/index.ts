import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../generated/client/client";

export interface DatabaseHealth {
  status: "ok" | "degraded";
  checkedAt: string;
}

export function createDatabaseHealth(status: DatabaseHealth["status"] = "ok"): DatabaseHealth {
  return {
    status,
    checkedAt: new Date().toISOString()
  };
}

export { Prisma, PrismaClient };
export type DatabaseClient = PrismaClient;

export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create a Prisma client.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString })
  });
}
