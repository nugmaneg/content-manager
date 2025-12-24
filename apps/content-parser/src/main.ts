import { NestFactory } from '@nestjs/core';
import { ContentParserModule } from './content-parser.module';

async function bootstrap() {
  const app = await NestFactory.create(ContentParserModule);

  // Включаем обработку сигналов завершения (SIGTERM, SIGINT)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
