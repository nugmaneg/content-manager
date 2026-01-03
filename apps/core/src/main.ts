import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { CoreModule } from './core.module';
import { WinstonModule } from 'nest-winston';
import { getLoggerConfig, AllExceptionsFilter } from '@logger';

async function bootstrap() {
  const app = await NestFactory.create(CoreModule, {
    logger: WinstonModule.createLogger(getLoggerConfig('core')),
  });

  // Enable validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Enable CORS for web admin
  app.enableCors({
    origin: true, // Allow all origins in dev, configure for prod
    credentials: true,
  });

  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapterHost));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
