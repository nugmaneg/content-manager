import { Injectable, Logger } from '@nestjs/common';
import {
    DatabaseGrpcClient,
    RawContentResponse,
    CreateContentUnitRequest,
} from '../../../grpc';
import { AiProducer } from '../../../queues/ai.producer';
import {
    FullContentAnalysisResult,
    AnalyzeContentPayload,
    ContentInput,
} from '@queue-contracts/ai';

/**
 * AiAnalysisService — сервис для AI-анализа сырого контента.
 *
 * Отвечает за:
 * - Получение RawContent из БД
 * - Вызов AI-Service для анализа
 * - Преобразование результата в формат для сохранения
 */
@Injectable()
export class AiAnalysisService {
    private readonly logger = new Logger(AiAnalysisService.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly aiProducer: AiProducer,
    ) { }

    /**
     * Проанализировать RawContent через AI-Service.
     * Возвращает результат анализа и подготовленные запросы на создание ContentUnit.
     */
    async analyzeRawContent(rawContentId: string): Promise<{
        rawContent: RawContentResponse;
        analysisResult: FullContentAnalysisResult;
        unitRequests: CreateContentUnitRequest[];
    }> {
        // 1. Получить RawContent
        const rawContent = await this.dbClient.getRawContent(rawContentId);
        if (!rawContent) {
            throw new Error(`RawContent not found: ${rawContentId}`);
        }

        this.logger.debug(
            `Analyzing raw content ${rawContentId}, text length: ${rawContent.text.length}`,
        );

        // 2. Обновить статус на PROCESSING
        await this.dbClient.updateRawContentStatus(rawContentId, 'PROCESSING');

        // 3. Подготовить структурированный input
        const contentInput = this.buildContentInput(rawContent);

        const payload: AnalyzeContentPayload = {
            rawContentId,
            input: contentInput,
            options: {
                skipMediaAnalysis: !rawContent.media_json, // Пропустить если нет медиа
                skipFactCheck: false,
            },
        };

        // 4. Вызвать AI анализ
        const analysisResult = await this.aiProducer.analyzeContent(payload);

        this.logger.debug(
            `AI analysis complete: ${analysisResult.units?.length || 0} units, ` +
            `primaryType: ${analysisResult.aggregated?.primaryType}`,
        );

        // 5. Преобразовать в CreateContentUnitRequest[]
        const unitRequests = this.mapUnitsToRequests(rawContentId, analysisResult);

        return {
            rawContent,
            analysisResult,
            unitRequests,
        };
    }

    /**
     * Построить ContentInput из RawContent
     */
    private buildContentInput(rawContent: RawContentResponse): ContentInput {
        const urls = rawContent.urls_json
            ? JSON.parse(rawContent.urls_json)
            : [];

        const sourceMeta = rawContent.source_meta_json
            ? JSON.parse(rawContent.source_meta_json)
            : {};

        // Извлекаем данные из external_id формата "channelId:messageId"
        const [channelId, postId] = rawContent.external_id.split(':');

        return {
            text: rawContent.text,
            urls,
            source: {
                platform: 'telegram' as const,
                channelId: channelId || rawContent.source_id,
                postId: postId || rawContent.external_id,
                postDate: rawContent.received_at || new Date().toISOString(),
                ...sourceMeta,
            },
        };
    }

    /**
     * Преобразовать units из AI результата в запросы на создание ContentUnit.
     */
    private mapUnitsToRequests(
        rawContentId: string,
        analysisResult: FullContentAnalysisResult,
    ): CreateContentUnitRequest[] {
        if (!analysisResult.units || analysisResult.units.length === 0) {
            this.logger.warn(`No units in analysis result for ${rawContentId}`);
            return [];
        }

        return analysisResult.units.map((unit) => ({
            raw_content_id: rawContentId,
            unit_index: unit.unitIndex,
            quality_score: unit.qualityScore,
            quality_reasoning: unit.qualityReasoning || '',
            original_text: unit.originalText,
            content_type: unit.contentType,
            categories_json: JSON.stringify(unit.categories || []),
            summary: unit.summary,
            sentiment: unit.sentiment,
            keywords_json: JSON.stringify(unit.keywords || []),
            language: unit.language,
            entities_json: unit.entities ? JSON.stringify(unit.entities) : undefined,
            linked_media_indexes_json: unit.linkedMediaIndexes
                ? JSON.stringify(unit.linkedMediaIndexes)
                : undefined,
            needs_fact_check: unit.needsFactCheck,
            fact_check_hint_json: unit.factCheckHint
                ? JSON.stringify(unit.factCheckHint)
                : undefined,
        }));
    }
}
