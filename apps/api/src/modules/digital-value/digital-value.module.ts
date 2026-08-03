import { Module } from '@nestjs/common';

import { DigitalValueService } from './digital-value.service';
import { DigitalValueController, AdminDigitalValueController } from './digital-value.controller';
import { PrismaModule } from '../prisma.module';
import { QueueProducerService } from '../queue-producer.service';
import { FxModule } from '../fx/fx.module';

@Module({
  imports: [FxModule, PrismaModule],
  providers: [QueueProducerService, DigitalValueService],
  controllers: [DigitalValueController, AdminDigitalValueController],
  exports: [DigitalValueService]
})
export class DigitalValueModule {}
