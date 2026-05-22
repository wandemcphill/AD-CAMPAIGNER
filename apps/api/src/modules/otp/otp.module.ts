import { Module } from "@nestjs/common";

import { AdminOtpController, OtpController } from "./otp.controller";
import { OtpMarketplaceService } from "./otp.service";

@Module({
  controllers: [OtpController, AdminOtpController],
  providers: [OtpMarketplaceService],
  exports: [OtpMarketplaceService]
})
export class OtpModule {}
