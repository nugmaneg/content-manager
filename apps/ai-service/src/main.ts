import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { AiServiceModule } from './ai-service.module';
import { WinstonModule } from 'nest-winston';
import { getLoggerConfig, AllExceptionsFilter } from '@logger';

async function bootstrap() {
  const app = await NestFactory.create(AiServiceModule, {
    logger: WinstonModule.createLogger(getLoggerConfig('ai-service')),
  });

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}
bootstrap();
