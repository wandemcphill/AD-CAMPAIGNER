import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma.module";
import { PersonasController } from "./personas.controller";
import { PersonasService } from "./personas.service";

@Module({
  imports: [PrismaModule],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService]
})
export class PersonasModule {}
