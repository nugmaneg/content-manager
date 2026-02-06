import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient, ContentUnitResponse } from '../../../grpc';
import { AiProducer } from '../../../queues/ai.producer';
import { ContentUnitStatus } from '../content-pipeline.constants';
import { ContentUnitBasic, ContentType } from '@queue-contracts/ai';

/**
 * AnalysisService — сервис для глубокого анализа ContentUnit.
 *
 * Отвечает за:
 * - Анализ одного или нескольких units (STAGE 2)
 * - Получение summary, entities, keywords, sentiment от AI
 * - Обновление units в БД с enriched данными
 * - Идемпотентность: проверка статуса перед выполнением
 * - Параллельная обработка через Promise.all
 */
@Injectable()
export class AnalysisService {
    private readonly logger = new Logger(AnalysisService.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly aiProducer: AiProducer,
    ) {}

    /**
     * Проанализировать один ContentUnit.
     * Идемпотентная операция: если unit уже проанализирован, возвращает его без изменений.
     */
    async analyzeUnit(unitId: string): Promise<ContentUnitResponse> {
        const unit = await this.dbClient.getContentUnit(unitId);

        // ✅ Идемпотентность: проверка состояния
        if (unit.status !== ContentUnitStatus.PENDING) {
            this.logger.debug(`Unit ${unitId} already analyzed (status: ${unit.status})`);
            return unit;
        }

        this.logger.debug(`Analyzing unit ${unitId}`);

        // Конвертация в ContentUnitBasic для AI
        const unitBasic = this.toContentUnitBasic(unit);

        // Вызов AI для анализа (STAGE 2)
        const analysis = await this.aiProducer.analyzeContentUnit({
            unitId,
            unit: unitBasic,
            provider: 'xai',
        });

        // Обновление в БД с результатами анализа
        const updated = await this.dbClient.updateContentUnitAnalysis(unitId, {
            summary: analysis.summary,
            entities: analysis.entities,
            keywords: analysis.keywords,
            sentiment: analysis.sentiment,
            needsFactCheck: analysis.needsFactCheck,
            factCheckHint: analysis.factCheckHint,
        });

        // Обновить статус
        await this.dbClient.updateContentUnitStatus(unitId, ContentUnitStatus.ANALYZED);

        this.logger.debug(`✅ Unit ${unitId} analyzed`);

        // Вернуть обновленный unit
        return await this.dbClient.getContentUnit(unitId);
    }

    /**
     * Параллельная обработка нескольких units через Promise.all.
     * В 5-10x быстрее чем последовательная обработка через for.
     */
    async analyzeUnitsInParallel(unitIds: string[]): Promise<ContentUnitResponse[]> {
        this.logger.log(`Analyzing ${unitIds.length} units in parallel`);

        const results = await Promise.all(unitIds.map((id) => this.analyzeUnit(id)));

        this.logger.log(`✅ Analyzed ${unitIds.length} units in parallel`);

        return results;
    }

    /**
     * Конвертировать ContentUnitResponse в ContentUnitBasic для AI.
     */
    private toContentUnitBasic(unit: ContentUnitResponse): ContentUnitBasic {
        return {
            unitIndex: unit.unit_index,
            originalText: unit.original_text,
            contentType: unit.content_type as ContentType,
            qualityScore: unit.quality_score,
            qualityReasoning: unit.quality_reasoning,
            language: unit.language,
        };
    }
}
