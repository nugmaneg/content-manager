import { Injectable, Logger } from '@nestjs/common';
import { DatabaseGrpcClient, ContentUnitResponse } from '../../../grpc';
import { AiProducer } from '../../../queues/ai.producer';
import { ContentUnitStatus } from '../content-pipeline.constants';
import { ContentUnitAnalysis, ContentType } from '@queue-contracts/ai';

/**
 * FactCheckingService — сервис для fact-checking ContentUnits.
 *
 * Отвечает за:
 * - Фильтрацию units, которым нужен fact-check (STAGE 5)
 * - Batch обработку через AI
 * - Обновление результатов в БД
 * - Идемпотентность: пропуск уже проверенных units
 */
@Injectable()
export class FactCheckingService {
    private readonly logger = new Logger(FactCheckingService.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
        private readonly aiProducer: AiProducer,
    ) {}

    /**
     * Выполнить fact-checking для списка units.
     * Идемпотентная операция: пропускает units, у которых уже есть fact_check_result.
     */
    async factCheckUnits(unitIds: string[]): Promise<void> {
        if (unitIds.length === 0) {
            this.logger.debug('No units provided for fact-checking');
            return;
        }

        // Загрузить units из БД
        const units = await Promise.all(unitIds.map((id) => this.dbClient.getContentUnit(id)));

        // ✅ Фильтрация: только те, которым нужен fact-check и еще не проверены
        const toCheck = units.filter((u) => {
            if (!u) return false;

            // Идемпотентность: пропускаем уже проверенные
            if (u.fact_check_result_json) {
                this.logger.debug(`Unit ${u.id} already fact-checked, skipping`);
                return false;
            }

            // Проверяем что unit требует fact-check
            if (!u.needs_fact_check) {
                this.logger.debug(`Unit ${u.id} does not need fact-check, skipping`);
                return false;
            }

            // Проверяем статус
            if (u.status !== ContentUnitStatus.MATCHED) {
                this.logger.warn(
                    `Unit ${u.id} has wrong status for fact-checking: ${u.status}, expected MATCHED`,
                );
                return false;
            }

            return true;
        });

        if (toCheck.length === 0) {
            this.logger.log('No units need fact-checking (all already checked or not required)');
            return;
        }

        this.logger.log(`Starting fact-checking for ${toCheck.length} units`);

        // Конвертация в ContentUnitAnalysis для AI
        const unitsForCheck = toCheck.map((u) => this.toContentUnitAnalysis(u));

        // Batch fact-check через AI
        const result = await this.aiProducer.factCheckContent({
            units: unitsForCheck,
            provider: 'xai',
        });

        // Обновление результатов в БД
        const updates = result.units.map((u) => {
            const originalUnit = toCheck.find((ou) => ou.unit_index === u.unitIndex);
            if (!originalUnit) {
                throw new Error(`Unit with index ${u.unitIndex} not found in original units`);
            }
            return {
                id: originalUnit.id,
                factCheckResult: u.factCheckResult!,
            };
        });

        await this.dbClient.updateContentUnitsFactCheck(updates);

        // Обновить статусы units
        await Promise.all(
            toCheck.map((u) =>
                this.dbClient.updateContentUnitStatus(u.id, ContentUnitStatus.FACT_CHECKED),
            ),
        );

        this.logger.log(`✅ Fact-checking completed for ${toCheck.length} units`);
    }

    /**
     * Конвертировать ContentUnitResponse в ContentUnitAnalysis для AI.
     */
    private toContentUnitAnalysis(unit: ContentUnitResponse): ContentUnitAnalysis {
        return {
            unitIndex: unit.unit_index,
            qualityScore: unit.quality_score,
            qualityReasoning: unit.quality_reasoning,
            originalText: unit.original_text,
            contentType: unit.content_type as ContentType,
            categories: JSON.parse(unit.categories_json || '[]'),
            summary: unit.summary,
            sentiment: unit.sentiment ? JSON.parse(unit.sentiment) : { label: 'neutral', score: 0 },
            keywords: JSON.parse(unit.keywords_json || '[]'),
            language: unit.language,
            entities: unit.entities_json ? JSON.parse(unit.entities_json) : undefined,
            linkedMediaIndexes: unit.linked_media_indexes_json
                ? JSON.parse(unit.linked_media_indexes_json)
                : undefined,
            needsFactCheck: unit.needs_fact_check,
            factCheckHint: unit.fact_check_hint_json
                ? JSON.parse(unit.fact_check_hint_json)
                : undefined,
        };
    }
}
