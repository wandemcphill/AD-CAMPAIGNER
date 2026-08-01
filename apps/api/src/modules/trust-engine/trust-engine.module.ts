import { Module } from '@nestjs/common';
import { TrustEngineService } from '@fliptrybe/service-trust-engine';
import { TrustEngineController } from './trust-engine.controller.js';
import { TrustEngineRepositories } from './repositories.js';
import { TrustEngineStages } from './stages.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Module({
  controllers: [TrustEngineController],
  providers: [
    PrismaService,
    TrustEngineRepositories,
    TrustEngineStages,
    {
      provide: TrustEngineService,
      inject: [TrustEngineRepositories, TrustEngineStages, 'LOGGER'],
      useFactory: (repos, stages, logger) => {
        return new TrustEngineService({
          submissionRepo: repos.submissionRepo,
          validationRunRepo: repos.validationRunRepo,
          stageResultRepo: repos.stageResultRepo,
          stages: stages.all,
          logger,
        });
      },
    },
    {
      provide: 'LOGGER',
      useFactory: () => {
        return {
          debug: (msg, ctx) => console.debug(`[trust-engine] ${msg}`, ctx || ''),
          info: (msg, ctx) => console.info(`[trust-engine] ${msg}`, ctx || ''),
          error: (msg, err, ctx) => console.error(`[trust-engine] ${msg}`, err, ctx || ''),
        };
      },
    },
  ],
  exports: [TrustEngineService],
})
export class TrustEngineModule {}
