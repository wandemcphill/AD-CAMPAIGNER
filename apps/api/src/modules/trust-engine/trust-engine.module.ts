import { Module } from '@nestjs/common';
import { TrustEngineService, ConsoleLogger } from '@fliptrybe/service-trust-engine';
import { TrustEngineController } from './trust-engine.controller';
import { TrustEngineRepositories } from './repositories';
import { TrustEngineStages } from './stages';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TrustEngineController],
  providers: [
    PrismaService,
    TrustEngineRepositories,
    TrustEngineStages,
    {
      provide: TrustEngineService,
      inject: [TrustEngineRepositories, TrustEngineStages],
      useFactory: (repos: TrustEngineRepositories, stages: TrustEngineStages) => {
        return new TrustEngineService({
          submissionRepo: repos.submissionRepo,
          validationRunRepo: repos.validationRunRepo,
          stageResultRepo: repos.stageResultRepo,
          stages: stages.all,
          logger: new ConsoleLogger(),
        });
      },
    },
  ],
  exports: [TrustEngineService],
})
export class TrustEngineModule {}
