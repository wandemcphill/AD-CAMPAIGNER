import "reflect-metadata";

import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./modules/app.module";
import { validateEnvironment } from "./env.validation";

async function bootstrap() {
  validateEnvironment();

  const corsOrigins = process.env.FRONTEND_URLS?.split(",").map((url) => url.trim()) ?? [
    "http://localhost:3000",
    "http://localhost:3001"
  ];

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: corsOrigins,
      credentials: false,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"]
    }
  });
  app.setGlobalPrefix("v1", {
    exclude: [{ path: "api/webhooks/korapay", method: RequestMethod.POST }]
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true
    })
  );

  const config = new DocumentBuilder()
    .setTitle("FlipTrybe Ads Campaigner API")
    .setDescription(
      "Phase 1 foundation API for campaigns, payments, SMM, analytics, admin, and support."
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
