import { Module } from '@nestjs/common';

import { DigitalValueService } from './digital-value.service';
import { DigitalValueController, AdminDigitalValueController } from './digital-value.controller';
import { FxModule } from '../fx/fx.module';

@Module({
  imports: [FxModule],
  providers: [DigitalValueService],
  controllers: [DigitalValueController, AdminDigitalValueController],
  exports: [DigitalValueService]
})
export class DigitalValueModule {}
