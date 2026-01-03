import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreController } from './core.controller';
import { CoreService } from './core.service';
import { QueuesModule } from './queues/queues.module';
import { TelegramQueueController } from './telegram-queue.controller';
import { PipelineModule } from './pipeline/pipeline.module';
import { AuthModule } from './auth';
import { WorkspacesModule } from './workspaces';
import { SourcesModule } from './sources';
import { LoggerMiddleware } from '@logger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    QueuesModule,
    PipelineModule,
    AuthModule,
    WorkspacesModule,
    SourcesModule,
  ],
  controllers: [CoreController, TelegramQueueController],
  providers: [CoreService],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
