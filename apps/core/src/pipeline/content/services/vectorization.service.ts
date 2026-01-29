import { Injectable, Logger } from '@nestjs/common';
import {
    DatabaseGrpcClient,
    ContentUnitResponse,
    CreateContentUnitRequest,
} from '../../../grpc';
import { AiProducer } from '../../../queues/ai.producer';
import { CONTENT_PIPELINE_CONFIG } from '../content-pipeline.constants';

/**
 * VectorizationService — сервис для сохранения и векторизации ContentUnit.
 *
 * Отвечает за:
 * - Сохранение ContentUnit в БД
 * - Генерацию эмбеддингов для summary каждого юнита
 * - Сохранение векторов в Qdrant
 * - Обновление ContentUnit с qdrant_id
 */
@Injectable()
export class VectorizationService {
    private readonly logger = new Logger(VectorizationService.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly aiProducer: AiProducer,
    ) { }

    /**
     * Сохранить ContentUnit-ы и векторизовать их.
     */
    async processUnits(
        unitRequests: CreateContentUnitRequest[],
    ): Promise<ContentUnitResponse[]> {
        if (unitRequests.length === 0) {
            this.logger.warn('No units to process');
            return [];
        }

        // 1. Сохранить все юниты в БД
        this.logger.debug(`Saving ${unitRequests.length} content units to database`);
        const savedUnits = await this.dbClient.createContentUnits(unitRequests);

        this.logger.debug(`Saved ${savedUnits.length} units, starting vectorization`);

        // 2. Векторизовать каждый юнит
        const vectorizedUnits: ContentUnitResponse[] = [];

        for (const unit of savedUnits) {
            try {
                const vectorizedUnit = await this.vectorizeUnit(unit);
                vectorizedUnits.push(vectorizedUnit);
            } catch (error) {
                this.logger.error(
                    `Failed to vectorize unit ${unit.id}: ${error instanceof Error ? error.message : error}`,
                );
                // Продолжаем с остальными юнитами
                vectorizedUnits.push(unit);
            }
        }

        this.logger.debug(
            `Vectorization complete: ${vectorizedUnits.filter((u) => u.qdrant_id).length}/${vectorizedUnits.length} units`,
        );

        return vectorizedUnits;
    }

    /**
     * Векторизовать один юнит:
     * 1. Сгенерировать эмбеддинг для summary
     * 2. Сохранить вектор в Qdrant
     * 3. Обновить unit с qdrant_id
     */
    private async vectorizeUnit(
        unit: ContentUnitResponse,
    ): Promise<ContentUnitResponse> {
        // 1. Генерация эмбеддинга
        const embeddingResult = await this.aiProducer.generateEmbedding({
            text: unit.summary,
        });

        // 2. Сохранение в Qdrant
        const qdrantResult = await this.dbClient.upsertContentUnitVector(unit.id, {
            vector: embeddingResult.embedding,
            summary: unit.summary,
            contentType: unit.content_type,
            language: unit.language,
        });

        // 3. Обновление unit с qdrant_id
        const updatedUnit = await this.dbClient.updateContentUnitVector(
            unit.id,
            qdrantResult.qdrant_id,
            CONTENT_PIPELINE_CONFIG.embeddingModel,
        );

        this.logger.debug(
            `Vectorized unit ${unit.id}: qdrant_id=${qdrantResult.qdrant_id}`,
        );

        return updatedUnit;
    }
}
