import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient, ContentUnitResponse } from '../../../grpc';
import { SegmentationService } from '../services/segmentation.service';
import { AnalysisService } from '../services/analysis.service';
import { VectorizationService } from '../services/vectorization.service';
import { TopicMatchingService } from '../services/topic-matching.service';
import { FactCheckingService } from '../services/fact-checking.service';
import {
    RawContentStatus,
    ContentUnitStatus,
    ProcessRawContentPayload,
    ProcessRawContentResult,
} from '../content-pipeline.constants';

/**
 * ContentOrchestrator — главный координатор обработки контента.
 *
 * Трёхэтапная архитектура с идемпотентностью и параллелизмом:
 * - STAGE 1: Segmentation (RawContent → ContentUnits)
 * - STAGE 2: Analysis (ContentUnit enrichment) — параллельно
 * - STAGE 3: Vectorization → Topic Matching
 * - STAGE 4: Fact-Checking (только для новых Topics)
 *
 * Ключевые особенности:
 * - Идемпотентность: проверка статусов перед каждым этапом
 * - Параллелизм: Promise.all вместо for-циклов
 * - State Machine: двухуровневое управление (RawContent + ContentUnit)
 * - Безопасные retry через BullMQ
 */
@Injectable()
export class ContentOrchestrator {
    private readonly logger = new Logger(ContentOrchestrator.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly segmentationService: SegmentationService,
        private readonly analysisService: AnalysisService,
        private readonly vectorizationService: VectorizationService,
        private readonly topicMatchingService: TopicMatchingService,
        private readonly factCheckingService: FactCheckingService,
    ) {}

    /**
     * Обработать RawContent через весь pipeline.
     * Идемпотентная операция: можно перезапустить с любого этапа.
     */
    async processRawContent(
        payload: ProcessRawContentPayload,
    ): Promise<ProcessRawContentResult> {
        const { rawContentId, options } = payload;
        const startTime = Date.now();

        try {
            const rawContent = await this.dbClient.getRawContent(rawContentId);

            if (!rawContent) {
                throw new Error(`RawContent not found: ${rawContentId}`);
            }

            // ========================================================
            // STAGE 1: SEGMENTATION (идемпотентно)
            // ========================================================
            let units: ContentUnitResponse[];

            if (rawContent.status === RawContentStatus.PENDING) {
                this.logger.log(`📋 Stage 1: Segmentation for ${rawContentId}`);
                units = await this.segmentationService.segmentRawContent(rawContentId);

                if (units.length === 0) {
                    await this.dbClient.updateRawContentStatus(
                        rawContentId,
                        RawContentStatus.COMPLETED,
                    );
                    return this.buildResult(rawContentId, 'completed', 0, 0, startTime);
                }

                // Обновить статус RawContent → PROCESSING
                await this.dbClient.updateRawContentStatus(
                    rawContentId,
                    RawContentStatus.PROCESSING,
                );

                this.logger.log(`✅ Stage 1: ${units.length} units segmented`);
            } else {
                // Идемпотентность: загрузить существующие units
                this.logger.debug(`Stage 1 already completed, loading existing units`);
                units = await this.dbClient.getContentUnitsByRawContentId(rawContentId);
            }

            // ========================================================
            // STAGE 2: ANALYSIS (параллельно через Promise.all)
            // ========================================================
            this.logger.log(`🔍 Stage 2: Analyzing ${units.length} units in parallel`);

            const pendingUnits = units.filter((u) => u.status === ContentUnitStatus.PENDING);

            if (pendingUnits.length > 0) {
                await this.analysisService.analyzeUnitsInParallel(
                    pendingUnits.map((u) => u.id),
                );
                this.logger.log(`✅ Stage 2: ${pendingUnits.length} units analyzed`);
            } else {
                this.logger.debug(`Stage 2: All units already analyzed`);
            }

            // Перезагрузить units с обновленными данными
            units = await this.dbClient.getContentUnitsByRawContentId(rawContentId);

            // ========================================================
            // STAGE 3: VECTORIZATION (параллельно через Promise.all)
            // ========================================================
            this.logger.log(`🧮 Stage 3: Vectorizing ${units.length} units in parallel`);

            const analyzedUnits = units.filter((u) => u.status === ContentUnitStatus.ANALYZED);

            if (analyzedUnits.length > 0) {
                await this.vectorizationService.vectorizeUnitsInParallel(
                    analyzedUnits.map((u) => u.id),
                );
                this.logger.log(`✅ Stage 3: ${analyzedUnits.length} units vectorized`);
            } else {
                this.logger.debug(`Stage 3: All units already vectorized`);
            }

            // Перезагрузить units
            units = await this.dbClient.getContentUnitsByRawContentId(rawContentId);

            // ========================================================
            // STAGE 4: TOPIC MATCHING (параллельно через Promise.all)
            // ========================================================
            let topicsMatched = 0;
            const newTopicUnits: string[] = [];

            if (!options?.skipTopicMatching) {
                this.logger.log(`🔗 Stage 4: Topic matching for ${units.length} units in parallel`);

                const vectorizedUnits = units.filter(
                    (u) => u.status === ContentUnitStatus.VECTORIZED,
                );

                if (vectorizedUnits.length > 0) {
                    const topicResults = await this.topicMatchingService.assignUnitsToTopics(
                        vectorizedUnits.map((u) => u.id),
                    );

                    topicsMatched = topicResults.filter((r) => r.action !== 'skipped').length;

                    // Собрать units для новых Topics с needsFactCheck
                    for (const result of topicResults) {
                        if (result.action === 'created_new' && result.needsFactCheck) {
                            newTopicUnits.push(result.unitId);
                        }
                    }

                    this.logger.log(
                        `✅ Stage 4: ${topicsMatched} matched, ${newTopicUnits.length} need fact-check`,
                    );
                } else {
                    this.logger.debug(`Stage 4: All units already matched`);
                }
            }

            // Перезагрузить units
            units = await this.dbClient.getContentUnitsByRawContentId(rawContentId);

            // ========================================================
            // STAGE 5: FACT-CHECKING (только для новых Topics)
            // ========================================================
            if (newTopicUnits.length > 0) {
                this.logger.log(`🔍 Stage 5: Fact-checking ${newTopicUnits.length} units`);
                await this.factCheckingService.factCheckUnits(newTopicUnits);
                this.logger.log(`✅ Stage 5: Fact-checking completed`);
            } else {
                this.logger.log(`⏭️ Stage 5: No fact-checking needed — saved ~60-70% cost!`);
            }

            // ========================================================
            // FINALIZATION: Обновить все units в READY
            // ========================================================
            units = await this.dbClient.getContentUnitsByRawContentId(rawContentId);

            const readyUnits = units.filter(
                (u) =>
                    u.status === ContentUnitStatus.MATCHED ||
                    u.status === ContentUnitStatus.FACT_CHECKED,
            );

            if (readyUnits.length > 0) {
                await Promise.all(
                    readyUnits.map((u) =>
                        this.dbClient.updateContentUnitStatus(u.id, ContentUnitStatus.READY),
                    ),
                );
            }

            // Обновить RawContent в COMPLETED
            await this.dbClient.updateRawContentStatus(rawContentId, RawContentStatus.COMPLETED);

            const durationMs = Date.now() - startTime;
            this.logger.log(
                `✅ Processed ${rawContentId}: ${units.length} units, ${topicsMatched} topics, ${durationMs}ms`,
            );

            return this.buildResult(
                rawContentId,
                'completed',
                units.length,
                topicsMatched,
                startTime,
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`❌ Failed to process ${rawContentId}: ${errorMessage}`);

            try {
                await this.dbClient.updateRawContentStatus(rawContentId, RawContentStatus.FAILED);
            } catch {
                // Игнорируем ошибку обновления статуса
            }

            return this.buildResult(rawContentId, 'failed', 0, 0, startTime, errorMessage);
        }
    }

    /**
     * Построить результат обработки.
     */
    private buildResult(
        rawContentId: string,
        status: 'completed' | 'failed',
        unitsCreated: number,
        topicsMatched: number,
        startTime: number,
        errorMessage?: string,
    ): ProcessRawContentResult {
        return {
            rawContentId,
            status,
            unitsCreated,
            topicsMatched,
            durationMs: Date.now() - startTime,
            errorMessage,
        };
    }
}
