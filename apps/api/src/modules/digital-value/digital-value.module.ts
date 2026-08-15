import { Module } from '@nestjs/common';

import { DigitalValueService } from './digital-value.service';
import { DigitalValueController, AdminDigitalValueController } from './digital-value.controller';
import { ProvidersModule } from "../providers/providers.module";
import { PrismaModule } from '../prisma.module';
import { QueueProducerService } from '../queue-producer.service';
import { FxModule } from '../fx/fx.module';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [FxModule, PrismaModule, ApprovalsModule, ProvidersModule],
  providers: [QueueProducerService, DigitalValueService],
  controllers: [DigitalValueController, AdminDigitalValueController],
  exports: [DigitalValueService]
})
export class DigitalValueModule {}
