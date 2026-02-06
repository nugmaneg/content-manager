import { Injectable, Logger } from '@nestjs/common';
import {
    DatabaseGrpcClient,
    ContentUnitResponse,
    TopicResponse,
    SimilarUnitResult,
} from '../../../grpc';
import { CONTENT_PIPELINE_CONFIG, ContentUnitStatus } from '../content-pipeline.constants';

export interface TopicAssignmentResult {
    unitId: string;
    topicId: string;
    action: 'created_new' | 'added_to_existing' | 'skipped';
    reason?: string;
    needsFactCheck?: boolean; // ADD: флаг для факт-чекинга
}

/**
 * TopicMatchingService — сервис для поиска и создания Topic-ов.
 *
 * Двухуровневый поиск:
 * - LEVEL 1: Поиск похожих Topics напрямую (0.85 threshold)
 * - LEVEL 2: Поиск похожих Units и взять их topicId
 *
 * Отвечает за:
 * - Smart similarity search с двухуровневым поиском
 * - Определение, есть ли подходящий Topic
 * - Создание нового Topic или привязка к существующему
 */
@Injectable()
export class TopicMatchingService {
    private readonly logger = new Logger(TopicMatchingService.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    /**
     * Получить вектор unit из Qdrant по qdrantId.
     */
    private async getUnitVector(qdrantId: string): Promise<number[]> {
        return await this.dbClient.getVectorByQdrantId('content_units', qdrantId);
    }

    /**
     * Назначить юнит к Topic-у через двухуровневый поиск (по unitId).
     * Идемпотентная операция: если unit уже привязан к Topic, возвращает существующую связь.
     *
     * LEVEL 1: Поиск похожих Topics напрямую
     * LEVEL 2: Поиск похожих Units → взять их topicId
     * Если ничего не найдено → создать новый Topic
     */
    async assignToTopic(unitId: string): Promise<TopicAssignmentResult> {
        const unit = await this.dbClient.getContentUnit(unitId);

        if (!unit) {
            throw new Error(`Unit not found: ${unitId}`);
        }

        // ✅ Идемпотентность: проверка состояния
        if (unit.status === ContentUnitStatus.MATCHED && unit.topic_id) {
            this.logger.debug(`Unit ${unitId} already matched to topic ${unit.topic_id}`);
            return {
                unitId,
                topicId: unit.topic_id,
                action: 'added_to_existing',
                needsFactCheck: false,
            };
        }

        if (unit.status !== ContentUnitStatus.VECTORIZED) {
            throw new Error(
                `Unit ${unitId} must be VECTORIZED before matching, current: ${unit.status}`,
            );
        }

        if (!unit.qdrant_id) {
            return {
                unitId: unit.id,
                topicId: '',
                action: 'skipped',
                reason: 'Unit not vectorized',
                needsFactCheck: false,
            };
        }

        // LEVEL 1: Поиск похожих Topics напрямую
        try {
            const vector = await this.getUnitVector(unit.qdrant_id);
            const similarTopics = await this.dbClient.searchSimilarTopics(vector, {
                limit: 3,
                minScore: CONTENT_PIPELINE_CONFIG.topicSimilarityThreshold,
            });

            if (similarTopics.length > 0) {
                this.logger.debug(
                    `LEVEL 1: Found ${similarTopics.length} similar topics for unit ${unit.id}`,
                );
                return await this.addToExistingTopic(unit, similarTopics[0].topicId, similarTopics[0].score);
            }
        } catch (error) {
            this.logger.debug(`LEVEL 1 skipped: ${error instanceof Error ? error.message : error}`);
        }

        // LEVEL 2: Поиск похожих Units
        const similarUnits = await this.dbClient.searchSimilarUnits(unit.qdrant_id, {
            limit: CONTENT_PIPELINE_CONFIG.similaritySearchLimit,
            minScore: CONTENT_PIPELINE_CONFIG.topicSimilarityThreshold,
        });

        this.logger.debug(
            `LEVEL 2: Found ${similarUnits.length} similar units for ${unit.id}`,
        );

        const unitWithTopic = similarUnits.find((u) => u.topic_id);

        if (unitWithTopic) {
            return await this.addToExistingTopic(unit, unitWithTopic.topic_id);
        }

        // Не найдено ни на LEVEL 1, ни на LEVEL 2 → создать новый Topic
        return await this.createNewTopic(unit);
    }

    /**
     * Добавить юнит к существующему Topic.
     * НЕ требует факт-чекинга (уже проверен ранее).
     */
    private async addToExistingTopic(
        unit: ContentUnitResponse,
        topicId: string,
        score?: number,
    ): Promise<TopicAssignmentResult> {
        // Обновить юнит с topic_id
        await this.dbClient.updateContentUnitTopic(unit.id, topicId);

        // Обновить статус unit
        await this.dbClient.updateContentUnitStatus(unit.id, ContentUnitStatus.MATCHED);

        // Увеличить версию Topic (показывает что добавился новый контент)
        const topic = await this.dbClient.getTopic(topicId);
        if (topic) {
            await this.dbClient.updateTopic(topicId, {
                version: topic.version + 1,
            });
        }

        this.logger.debug(
            `Added unit ${unit.id} to existing topic ${topicId}${score ? ` (similarity: ${score.toFixed(3)})` : ''} — no fact-check needed`,
        );

        return {
            unitId: unit.id,
            topicId,
            action: 'added_to_existing',
            needsFactCheck: false, // НЕ нужен факт-чекинг!
        };
    }

    /**
     * Создать новый Topic для юнита.
     * Требует факт-чекинг, если unit.needs_fact_check === true.
     */
    private async createNewTopic(
        unit: ContentUnitResponse,
    ): Promise<TopicAssignmentResult> {
        // Генерируем title из summary (первые 100 символов)
        const title = this.generateTopicTitle(unit.summary);

        // Создаём Topic
        const topic = await this.dbClient.createTopic({
            type: unit.content_type,
            title,
            summary: unit.summary,
            language: unit.language,
            embeddingModel: unit.embedding_model,
            qdrantId: unit.qdrant_id,
        });

        // Привязываем юнит к Topic
        await this.dbClient.updateContentUnitTopic(unit.id, topic.id);

        // Обновить статус unit
        await this.dbClient.updateContentUnitStatus(unit.id, ContentUnitStatus.MATCHED);

        this.logger.debug(
            `Created new topic ${topic.id} for unit ${unit.id}: "${title.slice(0, 50)}..." — fact-check will follow if needed`,
        );

        return {
            unitId: unit.id,
            topicId: topic.id,
            action: 'created_new',
            needsFactCheck: unit.needs_fact_check, // Передаём флаг
        };
    }

    /**
     * Сгенерировать title для Topic из summary.
     */
    private generateTopicTitle(summary: string): string {
        const maxLength = 100;

        // Обрезаем до maxLength
        if (summary.length <= maxLength) {
            return summary;
        }

        // Ищем последний пробел перед maxLength для красивого обрезания
        const lastSpace = summary.lastIndexOf(' ', maxLength);
        if (lastSpace > 50) {
            return summary.slice(0, lastSpace) + '...';
        }

        return summary.slice(0, maxLength) + '...';
    }

    /**
     * Обработать несколько юнитов для привязки к Topic-ам (параллельно через Promise.all).
     * В 5-10x быстрее чем последовательная обработка через for.
     */
    async assignUnitsToTopics(
        unitIds: string[],
    ): Promise<TopicAssignmentResult[]> {
        this.logger.log(`Assigning ${unitIds.length} units to topics in parallel`);

        // ✅ Параллельная обработка через Promise.all
        const results = await Promise.all(
            unitIds.map(async (unitId) => {
                try {
                    return await this.assignToTopic(unitId);
                } catch (error) {
                    this.logger.error(
                        `Failed to assign topic for unit ${unitId}: ${error instanceof Error ? error.message : error}`,
                    );
                    return {
                        unitId,
                        topicId: '',
                        action: 'skipped' as const,
                        reason: error instanceof Error ? error.message : 'Unknown error',
                    };
                }
            }),
        );

        // Логируем статистику
        const stats = {
            created: results.filter((r) => r.action === 'created_new').length,
            added: results.filter((r) => r.action === 'added_to_existing').length,
            skipped: results.filter((r) => r.action === 'skipped').length,
        };

        this.logger.log(
            `✅ Topic assignment complete: ${stats.created} new, ${stats.added} existing, ${stats.skipped} skipped`,
        );

        return results;
    }
}
