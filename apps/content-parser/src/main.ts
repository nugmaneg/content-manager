import { NestFactory } from '@nestjs/core';
import { ContentParserModule } from './content-parser.module';

async function bootstrap() {
  const app = await NestFactory.create(ContentParserModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
