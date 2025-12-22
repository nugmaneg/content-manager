
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiServiceController } from './ai-service.controller';
import { AiServiceService } from './ai-service.service';
import { AiProvidersModule } from './providers/ai-providers.module';
import { AiProcessor } from './processors/ai.processor';
import { QueuesModule } from './queues/queues.module';
import { AiProcessingProducer } from './queues/ai-processing.producer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    QueuesModule,
    AiProvidersModule,
  ],
  controllers: [AiServiceController],
  providers: [AiServiceService, AiProcessor, AiProcessingProducer],
})
export class AiServiceModule { }
