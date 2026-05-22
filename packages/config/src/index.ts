import { z } from "zod";

const providerSchema = z.enum(["mock", "sandbox", "live"]).default("mock");
const storageProviderSchema = z.enum(["mock", "cloudinary", "s3"]).default("mock");

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  ADMIN_URL: z.url().default("http://localhost:3001"),
  API_URL: z.url().default("http://localhost:4000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(24),
  SESSION_SECRET: z.string().min(24),
  STORAGE_PROVIDER: storageProviderSchema,
  ADS_PROVIDER: providerSchema,
  PAYMENT_PROVIDER: providerSchema,
  SMM_PROVIDER: providerSchema,
  AI_PROVIDER: providerSchema,
  NOTIFICATION_PROVIDER: providerSchema,
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_UPLOAD_PRESET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().optional(),
  CLOUDINARY_SECURE_DISTRIBUTION: z.string().optional(),
  SMDPANEL_ENDPOINT: z.string().optional(),
  SMDPANEL_API_URL: z.url().optional(),
  SMDPANEL_API_KEY: z.string().optional(),
  SMDPANEL_CURRENCY: z.string().optional(),
  SMDPANEL_SERVICE_MAP: z.string().optional(),
  SMMRAJA_API_URL: z.url().optional(),
  SMMRAJA_API_KEY: z.string().optional(),
  SMMRAJA_CURRENCY: z.string().optional(),
  SMMRAJA_SERVICE_MAP: z.string().optional(),
  JAP_API_URL: z.url().optional(),
  JAP_API_KEY: z.string().optional(),
  JAP_CURRENCY: z.string().optional(),
  JAP_SERVICE_MAP: z.string().optional(),
  PEAKERR_API_URL: z.url().optional(),
  PEAKERR_API_KEY: z.string().optional(),
  PEAKERR_CURRENCY: z.string().optional(),
  PEAKERR_SERVICE_MAP: z.string().optional()
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
