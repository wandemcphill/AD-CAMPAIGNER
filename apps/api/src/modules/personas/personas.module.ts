import { Module } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import { PersonasController } from "./personas.controller";
import { PersonasService } from "./personas.service";

@Module({
  controllers: [PersonasController],
  providers: [PrismaService, PersonasService],
  exports: [PersonasService]
})
export class PersonasModule {}
