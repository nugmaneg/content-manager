import { NestFactory } from '@nestjs/core';
import { AiServiceModule } from './ai-service.module';

async function bootstrap() {
  const app = await NestFactory.create(AiServiceModule);
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}
bootstrap();
