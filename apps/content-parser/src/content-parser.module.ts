import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContentParserController } from './content-parser.controller';
import { ContentParserService } from './content-parser.service';
import { SourcesModule } from './sources/sources.module';
import { QueuesModule } from './queues/queues.module';
import { LoggerMiddleware } from '@logger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueuesModule,
    SourcesModule,
  ],
  controllers: [ContentParserController],
  providers: [ContentParserService],
})
export class ContentParserModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
