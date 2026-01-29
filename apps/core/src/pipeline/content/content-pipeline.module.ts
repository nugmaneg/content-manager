import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ContentPipelineProducer } from './content-pipeline.producer';
import { ContentPipelineProcessor } from './content-pipeline.processor';
import { AiAnalysisService } from './services/ai-analysis.service';
import { VectorizationService } from './services/vectorization.service';
import { TopicMatchingService } from './services/topic-matching.service';
import { QUEUE_CONTENT_PIPELINE } from './content-pipeline.constants';
import { DatabaseGrpcClient } from '../../grpc';
import { QueuesModule } from '../../queues/queues.module';

/**
 * ContentPipelineModule — модуль для асинхронной обработки контента.
 *
 * Pipeline:
 * RawContent → AI Analysis → ContentUnit[] → Vectorization → Topic Matching
 *
 * Компоненты:
 * - ContentPipelineProducer: добавляет задачи в очередь
 * - ContentPipelineProcessor: воркер, обрабатывает задачи
 * - AiAnalysisService: вызов AI для анализа текста
 * - VectorizationService: создание эмбеддингов и сохранение в Qdrant
 * - TopicMatchingService: поиск похожих юнитов и привязка к Topic
 */
@Module({
    imports: [
        BullModule.registerQueue({
            name: QUEUE_CONTENT_PIPELINE,
        }),
        QueuesModule, // Для AiProducer
    ],
    providers: [
        DatabaseGrpcClient,
        ContentPipelineProducer,
        ContentPipelineProcessor,
        AiAnalysisService,
        VectorizationService,
        TopicMatchingService,
    ],
    exports: [ContentPipelineProducer],
})
export class ContentPipelineModule { }
