import { Injectable, Logger } from '@nestjs/common';
import {
    DatabaseGrpcClient,
    ContentUnitResponse,
    TopicResponse,
    SimilarUnitResult,
} from '../../../grpc';
import { CONTENT_PIPELINE_CONFIG } from '../content-pipeline.constants';

export interface TopicAssignmentResult {
    unitId: string;
    topicId: string;
    action: 'created_new' | 'added_to_existing' | 'skipped';
    reason?: string;
}

/**
 * TopicMatchingService — сервис для поиска и создания Topic-ов.
 *
 * Отвечает за:
 * - Similarity search по эмбеддингам юнитов
 * - Определение, есть ли подходящий Topic
 * - Создание нового Topic или привязка к существующему
 */
@Injectable()
export class TopicMatchingService {
    private readonly logger = new Logger(TopicMatchingService.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    /**
     * Назначить юнит к Topic-у:
     * 1. Поиск похожих юнитов в Qdrant
     * 2. Если есть юнит с Topic-ом → добавить к нему
     * 3. Если нет → создать новый Topic
     */
    async assignToTopic(unit: ContentUnitResponse): Promise<TopicAssignmentResult> {
        // Юнит без вектора не может быть привязан к топику
        if (!unit.qdrant_id) {
            return {
                unitId: unit.id,
                topicId: '',
                action: 'skipped',
                reason: 'Unit not vectorized',
            };
        }

        // 1. Поиск похожих юнитов
        const similarUnits = await this.dbClient.searchSimilarUnits(unit.qdrant_id, {
            limit: CONTENT_PIPELINE_CONFIG.similaritySearchLimit,
            minScore: CONTENT_PIPELINE_CONFIG.topicSimilarityThreshold,
        });

        this.logger.debug(
            `Found ${similarUnits.length} similar units for ${unit.id}`,
        );

        // 2. Найти юнит с существующим Topic
        const unitWithTopic = similarUnits.find((u) => u.topic_id);

        if (unitWithTopic) {
            // Добавить к существующему Topic
            return await this.addToExistingTopic(unit, unitWithTopic);
        } else {
            // Создать новый Topic
            return await this.createNewTopic(unit);
        }
    }

    /**
     * Добавить юнит к существующему Topic.
     */
    private async addToExistingTopic(
        unit: ContentUnitResponse,
        similarUnit: SimilarUnitResult,
    ): Promise<TopicAssignmentResult> {
        const topicId = similarUnit.topic_id;

        // Обновить юнит с topic_id
        await this.dbClient.updateContentUnitTopic(unit.id, topicId);

        // Увеличить версию Topic (показывает что добавился новый контент)
        const topic = await this.dbClient.getTopic(topicId);
        if (topic) {
            await this.dbClient.updateTopic(topicId, {
                version: topic.version + 1,
            });
        }

        this.logger.debug(
            `Added unit ${unit.id} to existing topic ${topicId} (similarity: ${similarUnit.score.toFixed(3)})`,
        );

        return {
            unitId: unit.id,
            topicId,
            action: 'added_to_existing',
        };
    }

    /**
     * Создать новый Topic для юнита.
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

        this.logger.debug(
            `Created new topic ${topic.id} for unit ${unit.id}: "${title.slice(0, 50)}..."`,
        );

        return {
            unitId: unit.id,
            topicId: topic.id,
            action: 'created_new',
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
     * Обработать несколько юнитов для привязки к Topic-ам.
     */
    async assignUnitsToTopics(
        units: ContentUnitResponse[],
    ): Promise<TopicAssignmentResult[]> {
        const results: TopicAssignmentResult[] = [];

        for (const unit of units) {
            try {
                const result = await this.assignToTopic(unit);
                results.push(result);
            } catch (error) {
                this.logger.error(
                    `Failed to assign topic for unit ${unit.id}: ${error instanceof Error ? error.message : error}`,
                );
                results.push({
                    unitId: unit.id,
                    topicId: '',
                    action: 'skipped',
                    reason: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        // Логируем статистику
        const stats = {
            created: results.filter((r) => r.action === 'created_new').length,
            added: results.filter((r) => r.action === 'added_to_existing').length,
            skipped: results.filter((r) => r.action === 'skipped').length,
        };

        this.logger.debug(
            `Topic assignment complete: ${stats.created} new, ${stats.added} existing, ${stats.skipped} skipped`,
        );

        return results;
    }
}
