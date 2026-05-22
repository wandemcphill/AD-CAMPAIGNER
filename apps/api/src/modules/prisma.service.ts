import { Injectable, OnModuleDestroy } from "@nestjs/common";

import { createPrismaClient, type DatabaseClient } from "@fliptrybe/database";

@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: DatabaseClient;

  constructor(client: DatabaseClient = createPrismaClient()) {
    this.client = client;
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
