function validateEnvironment() {
  const errors: string[] = [];

  // Required in production
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) {
      errors.push("JWT_SECRET is required in production");
    }
    if (!process.env.DATABASE_URL) {
      errors.push("DATABASE_URL is required in production");
    }
    if (!process.env.PRISMA_MIGRATE_DATABASE_URL) {
      errors.push("PRISMA_MIGRATE_DATABASE_URL is required in production");
    }
  }

  // Required always
  if (!process.env.PORT) {
    process.env.PORT = "4000";
  }

  if (errors.length > 0) {
    console.error("❌ Environment validation failed:");
    errors.forEach((error) => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log("✅ Environment validation passed");
}

export { validateEnvironment };
