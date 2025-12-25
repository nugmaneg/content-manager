import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ContentParserModule } from './content-parser.module';
import { WinstonModule } from 'nest-winston';
import { getLoggerConfig, AllExceptionsFilter } from '@logger';

async function bootstrap() {
  const app = await NestFactory.create(ContentParserModule, {
    logger: WinstonModule.createLogger(getLoggerConfig('content-parser')),
  });

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  // Включаем обработку сигналов завершения (SIGTERM, SIGINT)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
