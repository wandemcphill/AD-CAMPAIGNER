// Several services construct their real provider adapter at DI-instantiation time and
// throw immediately if the required credential env var is unset (deliberately, so a
// missing key fails loud instead of silently falling back to mock data in production).
// This test only exercises the DI *graph*, not live provider calls, so placeholder
// values are enough to get every service constructed -- must be set before AppModule
// (and its transitive service imports) loads.
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/db_boot_test";
process.env.SOGO_API_KEY ??= "boot-test-placeholder";
process.env.RELOADLY_CLIENT_ID ??= "boot-test-placeholder";
process.env.RELOADLY_CLIENT_SECRET ??= "boot-test-placeholder";
process.env.CLUBKONNECT_USER_ID ??= "boot-test-placeholder";
process.env.CLUBKONNECT_API_KEY ??= "boot-test-placeholder";

import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { AppModule } from "./app.module";

// Guards against dependency-injection wiring bugs (e.g. a service imported by
// another module's provider but never declared/exported from its own module)
// that plain unit tests miss, because they construct services directly with
// `new Foo(...)` rather than going through Nest's module graph. This test
// compiles the real AppModule the same way Nest does at boot — it's the
// earliest point in the test suite that would have caught the
// ProviderRouterService wiring bug that crashed production (see the "Fix
// production boot crash" commit).
describe("AppModule", () => {
  it("resolves the full dependency graph without a live database connection", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    expect(moduleRef).toBeDefined();

    await moduleRef.close();
  });
});
