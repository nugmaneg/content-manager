import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiServiceController } from './ai-service.controller';
import { AiProvidersModule } from './providers/ai-providers.module';
import { AiProcessor } from './processors/ai.processor';
import { QueuesModule } from './queues/queues.module';
import { PromptsModule } from './prompts/prompts.module';
import { AnalysisOrchestratorService } from './orchestrator/analysis-orchestrator.service';
import { AnalysisService } from './pipelines/analysis/analysis.service';
import { LoggerMiddleware } from '@logger';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    QueuesModule,
    AiProvidersModule,
    PromptsModule,
  ],
  controllers: [AiServiceController],
  providers: [
    AiProcessor,
    AnalysisOrchestratorService,
    AnalysisService,
  ],
})
export class AiServiceModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
