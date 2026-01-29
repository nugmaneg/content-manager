import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DatabaseGrpcClient } from '../../grpc';
import { AiAnalysisService } from './services/ai-analysis.service';
import { VectorizationService } from './services/vectorization.service';
import { TopicMatchingService } from './services/topic-matching.service';
import {
    QUEUE_CONTENT_PIPELINE,
    JOBS_CONTENT_PIPELINE,
    ProcessRawContentPayload,
    ProcessRawContentResult,
} from './content-pipeline.constants';

type ContentPipelineJobPayload = ProcessRawContentPayload;

/**
 * ContentPipelineProcessor — воркер для обработки контента.
 *
 * Выполняет полный цикл обработки:
 * 1. AI анализ RawContent → ContentUnit[]
 * 2. Векторизация юнитов → сохранение в Qdrant
 * 3. Поиск/создание Topic → привязка юнитов
 */
@Processor(QUEUE_CONTENT_PIPELINE)
@Injectable()
export class ContentPipelineProcessor extends WorkerHost {
    private readonly logger = new Logger(ContentPipelineProcessor.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly aiAnalysisService: AiAnalysisService,
        private readonly vectorizationService: VectorizationService,
        private readonly topicMatchingService: TopicMatchingService,
    ) {
        super();
    }

    async process(
        job: Job<ContentPipelineJobPayload, ProcessRawContentResult, string>,
    ): Promise<ProcessRawContentResult> {
        const startTime = Date.now();

        this.logger.log(
            `Processing job ${job.name} (ID: ${job.id})`,
        );

        switch (job.name) {
            case JOBS_CONTENT_PIPELINE.processRawContent:
                return await this.handleProcessRawContent(
                    job.data as ProcessRawContentPayload,
                    startTime,
                );

            default:
                this.logger.warn(`Unknown job name: ${job.name}`);
                return {
                    rawContentId: '',
                    status: 'failed',
                    unitsCreated: 0,
                    topicsMatched: 0,
                    errorMessage: `Unknown job name: ${job.name}`,
                    durationMs: Date.now() - startTime,
                };
        }
    }

    /**
     * Обработать RawContent:
     * 1. AI анализ → получить ContentUnit[]
     * 2. Сохранить и векторизовать юниты
     * 3. Привязать юниты к Topic-ам
     * 4. Обновить статус RawContent
     */
    private async handleProcessRawContent(
        payload: ProcessRawContentPayload,
        startTime: number,
    ): Promise<ProcessRawContentResult> {
        const { rawContentId, options } = payload;

        try {
            // 1. AI анализ
            this.logger.debug(`Step 1: AI analysis for ${rawContentId}`);
            const { unitRequests } = await this.aiAnalysisService.analyzeRawContent(
                rawContentId,
            );

            if (unitRequests.length === 0) {
                // Нет юнитов — контент пустой или не подходит
                await this.dbClient.updateRawContentStatus(
                    rawContentId,
                    'COMPLETED',
                    new Date().toISOString(),
                );

                return {
                    rawContentId,
                    status: 'completed',
                    unitsCreated: 0,
                    topicsMatched: 0,
                    durationMs: Date.now() - startTime,
                };
            }

            // 2. Сохранение и векторизация
            this.logger.debug(`Step 2: Vectorizing ${unitRequests.length} units`);
            const savedUnits = await this.vectorizationService.processUnits(unitRequests);

            // 3. Привязка к Topic (если не отключена)
            let topicsMatched = 0;
            if (!options?.skipTopicMatching) {
                this.logger.debug(`Step 3: Topic matching for ${savedUnits.length} units`);
                const topicResults = await this.topicMatchingService.assignUnitsToTopics(
                    savedUnits,
                );
                topicsMatched = topicResults.filter(
                    (r) => r.action !== 'skipped',
                ).length;
            }

            // 4. Обновить статус RawContent
            await this.dbClient.updateRawContentStatus(
                rawContentId,
                'COMPLETED',
                new Date().toISOString(),
            );

            const durationMs = Date.now() - startTime;
            this.logger.log(
                `✅ Processed ${rawContentId}: ${savedUnits.length} units, ${topicsMatched} topics, ${durationMs}ms`,
            );

            return {
                rawContentId,
                status: 'completed',
                unitsCreated: savedUnits.length,
                topicsMatched,
                durationMs,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - startTime;

            this.logger.error(`❌ Failed to process ${rawContentId}: ${errorMessage}`);

            // Обновить статус на FAILED
            try {
                await this.dbClient.updateRawContentStatus(rawContentId, 'FAILED');
            } catch {
                // Игнорируем ошибку обновления статуса
            }

            return {
                rawContentId,
                status: 'failed',
                unitsCreated: 0,
                topicsMatched: 0,
                errorMessage,
                durationMs,
            };
        }
    }
}
