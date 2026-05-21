import { z } from "zod";

const providerSchema = z.enum(["mock", "sandbox", "live"]).default("mock");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  ADMIN_URL: z.url().default("http://localhost:3001"),
  API_URL: z.url().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(24),
  SESSION_SECRET: z.string().min(24),
  STORAGE_PROVIDER: providerSchema,
  ADS_PROVIDER: providerSchema,
  PAYMENT_PROVIDER: providerSchema,
  SMM_PROVIDER: providerSchema,
  AI_PROVIDER: providerSchema,
  NOTIFICATION_PROVIDER: providerSchema
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadAppConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse({
    DATABASE_URL:
      source.DATABASE_URL ?? "postgresql://fliptrybe:fliptrybe@localhost:5432/fliptrybe_ads",
    JWT_SECRET: source.JWT_SECRET ?? "development-jwt-secret-replace-in-production",
    SESSION_SECRET: source.SESSION_SECRET ?? "development-session-secret-replace-now",
    ...source
  });
}
