import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { CoreModule } from './core.module';
import { WinstonModule } from 'nest-winston';
import { getLoggerConfig, AllExceptionsFilter } from '@logger';

async function bootstrap() {
  const app = await NestFactory.create(CoreModule, {
    logger: WinstonModule.createLogger(getLoggerConfig('core')),
  });

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
