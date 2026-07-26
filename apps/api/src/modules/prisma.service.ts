import { Injectable, Optional, OnModuleDestroy } from "@nestjs/common";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: DatabaseClient;

  // `client` is never meant to come from Nest's DI container -- `DatabaseClient` is a type-only
  // interface (erases to `Object` at runtime), and this parameter exists purely so tests can pass
  // a mock client directly via `new PrismaService(mockClient)`. @Optional() tells Nest not to try
  // (and fail) to resolve a provider for it; the default value applies whenever Nest constructs it.
  constructor(@Optional() client: DatabaseClient = createPrismaClient()) {
    this.client = client;
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
