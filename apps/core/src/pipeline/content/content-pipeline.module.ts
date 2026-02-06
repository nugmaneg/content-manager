import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ContentPipelineProducer } from './content-pipeline.producer';
import { ContentPipelineProcessor } from './content-pipeline.processor';
import { SegmentationService } from './services/segmentation.service';
import { AnalysisService } from './services/analysis.service';
import { VectorizationService } from './services/vectorization.service';
import { TopicMatchingService } from './services/topic-matching.service';
import { FactCheckingService } from './services/fact-checking.service';
import { ContentOrchestrator } from './orchestrator/content-orchestrator.service';
import { QUEUE_CONTENT_PIPELINE } from './content-pipeline.constants';
import { DatabaseGrpcClient } from '../../grpc';
import { QueuesModule } from '../../queues/queues.module';

/**
 * ContentPipelineModule — модуль для асинхронной обработки контента.
 *
 * Сервисная архитектура с State Machine и идемпотентностью:
 * - ContentOrchestrator: координация всех этапов обработки
 * - SegmentationService: STAGE 1 (RawContent → ContentUnits)
 * - AnalysisService: STAGE 2 (Unit enrichment: summary, entities, keywords)
 * - VectorizationService: STAGE 3 (Embeddings в Qdrant)
 * - TopicMatchingService: STAGE 4 (Двухуровневый поиск Topics)
 * - FactCheckingService: STAGE 5 (Fact-check для новых Topics)
 * - ContentPipelineProcessor: лёгкий BullMQ диспетчер
 * - ContentPipelineProducer: добавляет задачи в очередь
 *
 * Все сервисы поддерживают идемпотентность и параллельную обработку через Promise.all.
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

        // Сервисы для каждого этапа
        SegmentationService,
        AnalysisService,
        VectorizationService,
        TopicMatchingService,
        FactCheckingService,

        // Оркестратор
        ContentOrchestrator,

        // BullMQ
        ContentPipelineProducer,
        ContentPipelineProcessor,
    ],
    exports: [ContentPipelineProducer],
})
export class ContentPipelineModule { }
