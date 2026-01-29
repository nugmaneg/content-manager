import {
    Controller,
    Get,
    Query,
    UseGuards,
    Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth';
import { DatabaseGrpcClient, ContentUnitResponse } from '../grpc';

@Controller('api/content-units')
@UseGuards(JwtAuthGuard)
export class ContentUnitsController {
    private readonly logger = new Logger(ContentUnitsController.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    @Get()
    async findAll(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('rawContentId') rawContentId?: string,
        @Query('minQualityScore') minQualityScore?: string,
    ) {
        const result = await this.dbClient.listContentUnits({
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            rawContentId,
            minQualityScore: minQualityScore ? parseInt(minQualityScore, 10) : undefined,
        });

        return {
            items: result.items.map(this.formatContentUnit.bind(this)),
            total: result.total,
        };
    }

    private formatContentUnit(unit: ContentUnitResponse) {
        return {
            id: unit.id,
            rawContentId: unit.raw_content_id,
            unitIndex: unit.unit_index,
            qualityScore: unit.quality_score,
            qualityReasoning: unit.quality_reasoning,
            originalText: unit.original_text,
            contentType: unit.content_type,
            categories: unit.categories_json ? JSON.parse(unit.categories_json) : [],
            summary: unit.summary,
            sentiment: unit.sentiment,
            keywords: unit.keywords_json ? JSON.parse(unit.keywords_json) : [],
            language: unit.language,
            entities: unit.entities_json ? JSON.parse(unit.entities_json) : null,
            linkedMediaIndexes: unit.linked_media_indexes_json
                ? JSON.parse(unit.linked_media_indexes_json)
                : [],
            needsFactCheck: unit.needs_fact_check,
            factCheckHint: unit.fact_check_hint_json
                ? JSON.parse(unit.fact_check_hint_json)
                : null,
            factCheckResult: unit.fact_check_result_json
                ? JSON.parse(unit.fact_check_result_json)
                : null,
            qdrantId: unit.qdrant_id,
            topicId: unit.topic_id,
            createdAt: unit.created_at,
            updatedAt: unit.updated_at,
        };
    }
}
