import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient, ContentUnitResponse } from '../../../grpc';
import { AiProducer } from '../../../queues/ai.producer';
import { CONTENT_PIPELINE_CONFIG, ContentUnitStatus } from '../content-pipeline.constants';

/**
 * VectorizationService — сервис для векторизации ContentUnit.
 *
 * Отвечает за:
 * - Генерацию эмбеддингов для summary каждого юнита (STAGE 3)
 * - Сохранение векторов в Qdrant
 * - Обновление ContentUnit с qdrant_id
 * - Идемпотентность: проверка статуса перед выполнением
 * - Параллельная обработка через Promise.all
 */
@Injectable()
export class VectorizationService {
    private readonly logger = new Logger(VectorizationService.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly aiProducer: AiProducer,
    ) {}

    /**
     * Векторизовать один unit по ID.
     * Идемпотентная операция: если unit уже векторизован, возвращает его без изменений.
     */
    async vectorizeUnit(unitId: string): Promise<ContentUnitResponse> {
        const unit = await this.dbClient.getContentUnit(unitId);

        // ✅ Идемпотентность: проверка состояния
        if (unit.status === ContentUnitStatus.VECTORIZED || unit.qdrant_id) {
            this.logger.debug(`Unit ${unitId} already vectorized`);
            return unit;
        }

        if (unit.status !== ContentUnitStatus.ANALYZED) {
            throw new Error(
                `Unit ${unitId} must be ANALYZED before vectorization, current: ${unit.status}`,
            );
        }

        this.logger.debug(`Vectorizing unit ${unitId}`);

        // 1. Генерация эмбеддинга
        const embeddingResult = await this.aiProducer.generateEmbedding({
            text: unit.summary,
        });

        // 2. Сохранение в Qdrant
        const qdrantResult = await this.dbClient.upsertContentUnitVector(unitId, {
            vector: embeddingResult.embedding,
            summary: unit.summary,
            contentType: unit.content_type,
            language: unit.language,
        });

        // 3. Обновление unit с qdrant_id
        await this.dbClient.updateContentUnitVector(
            unitId,
            qdrantResult.qdrant_id,
            CONTENT_PIPELINE_CONFIG.embeddingModel,
        );

        // 4. Обновить статус
        await this.dbClient.updateContentUnitStatus(unitId, ContentUnitStatus.VECTORIZED);

        this.logger.debug(`✅ Unit ${unitId} vectorized: qdrant_id=${qdrantResult.qdrant_id}`);

        // Вернуть обновленный unit
        return await this.dbClient.getContentUnit(unitId);
    }

    /**
     * Параллельная векторизация нескольких units через Promise.all.
     * В 5-10x быстрее чем последовательная обработка через for.
     */
    async vectorizeUnitsInParallel(unitIds: string[]): Promise<ContentUnitResponse[]> {
        this.logger.log(`Vectorizing ${unitIds.length} units in parallel`);

        const results = await Promise.all(unitIds.map((id) => this.vectorizeUnit(id)));

        this.logger.log(`✅ Vectorized ${unitIds.length} units in parallel`);

        return results;
    }
}
