import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient, RawContentResponse, ContentUnitResponse } from '../../../grpc';
import { AiProducer } from '../../../queues/ai.producer';
import { RawContentStatus, ContentUnitStatus } from '../content-pipeline.constants';
import { ContentInput } from '@queue-contracts/ai';

/**
 * SegmentationService — сервис для сегментации RawContent на ContentUnits.
 *
 * Отвечает за:
 * - Получение RawContent из БД
 * - Конвертацию в ContentInput для AI
 * - Вызов AI для сегментации (STAGE 1)
 * - Сохранение базовых ContentUnits в БД с status = PENDING
 * - Идемпотентность: проверка статуса перед выполнением
 */
@Injectable()
export class SegmentationService {
    private readonly logger = new Logger(SegmentationService.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly aiProducer: AiProducer,
    ) {}

    /**
     * Сегментировать RawContent на ContentUnits.
     * Идемпотентная операция: если RawContent уже сегментирован, возвращает существующие units.
     */
    async segmentRawContent(rawContentId: string): Promise<ContentUnitResponse[]> {
        const rawContent = await this.dbClient.getRawContent(rawContentId);

        if (!rawContent) {
            throw new Error(`RawContent not found: ${rawContentId}`);
        }

        // ✅ Идемпотентность: проверка состояния
        if (rawContent.status !== RawContentStatus.PENDING) {
            this.logger.debug(
                `RawContent ${rawContentId} already segmented (status: ${rawContent.status}), returning existing units`,
            );
            return await this.dbClient.getContentUnitsByRawContentId(rawContentId);
        }

        this.logger.log(`Starting segmentation for RawContent ${rawContentId}`);

        // Конвертация в ContentInput для AI
        const contentInput = this.buildContentInput(rawContent);

        // Вызов AI для сегментации (STAGE 1)
        const result = await this.aiProducer.segmentContent({
            rawContentId,
            input: contentInput,
            provider: 'xai',
        });

        if (!result || !result.units || result.units.length === 0) {
            this.logger.warn(`No units created for RawContent ${rawContentId}`);
            // Обновить статус в SEGMENTED даже если units нет
            await this.dbClient.updateRawContentStatus(rawContentId, RawContentStatus.SEGMENTED);
            return [];
        }

        // Сохранение units в БД (параллельно через Promise.all)
        const units = await Promise.all(
            result.units.map((unit) =>
                this.dbClient.createContentUnit({
                    raw_content_id: rawContentId,
                    unit_index: unit.unitIndex,
                    original_text: unit.originalText,
                    content_type: unit.contentType,
                    quality_score: unit.qualityScore,
                    quality_reasoning: unit.qualityReasoning,
                    language: unit.language,
                    // Поля для STAGE 2 будут заполнены позже
                    summary: '',
                    sentiment: '',
                    keywords_json: '[]',
                    needs_fact_check: false,
                    // State Machine: начальный статус
                    status: ContentUnitStatus.PENDING,
                }),
            ),
        );

        // Обновить статус RawContent
        await this.dbClient.updateRawContentStatus(rawContentId, RawContentStatus.SEGMENTED);

        this.logger.log(`✅ Segmented RawContent ${rawContentId}: ${units.length} units created`);

        return units;
    }

    /**
     * Построить ContentInput из RawContent для передачи в AI.
     */
    private buildContentInput(rawContent: RawContentResponse): ContentInput {
        // Парсинг source_meta_json
        const sourceMeta = rawContent.source_meta_json
            ? JSON.parse(rawContent.source_meta_json)
            : {};

        // Парсинг media_json
        const media = rawContent.media_json ? JSON.parse(rawContent.media_json) : undefined;

        return {
            text: rawContent.text,
            source: {
                platform: 'telegram' as const, // TODO: определять из source.type
                channelId: rawContent.external_id.split(':')[0] || rawContent.source_id,
                postId: rawContent.external_id.split(':')[1] || rawContent.external_id,
                postDate: rawContent.received_at || new Date().toISOString(),
            },
            media,
        };
    }
}
