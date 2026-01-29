import {
    Controller,
    Get,
    Query,
    UseGuards,
    Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth';
import { DatabaseGrpcClient, RawContentResponse, ContentUnitResponse } from '../grpc';

@Controller('api/raw-content')
@UseGuards(JwtAuthGuard)
export class RawContentController {
    private readonly logger = new Logger(RawContentController.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    @Get()
    async findAll(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('status') status?: string,
        @Query('sourceId') sourceId?: string,
    ) {
        const result = await this.dbClient.listRawContent({
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            status,
            sourceId,
        });

        return {
            items: result.items.map(this.formatRawContent.bind(this)),
            total: result.total,
        };
    }

    private formatRawContent(raw: RawContentResponse) {
        return {
            id: raw.id,
            sourceId: raw.source_id,
            externalId: raw.external_id,
            text: raw.text,
            media: raw.media_json ? JSON.parse(raw.media_json) : null,
            urls: raw.urls_json ? JSON.parse(raw.urls_json) : null,
            sourceMeta: raw.source_meta_json ? JSON.parse(raw.source_meta_json) : null,
            status: raw.status,
            receivedAt: raw.received_at,
            processedAt: raw.processed_at,
            createdAt: raw.created_at,
            contentUnits: raw.content_units
                ? raw.content_units.map(this.formatContentUnit)
                : [],
        };
    }

    private formatContentUnit(unit: ContentUnitResponse) {
        return {
            id: unit.id,
            rawContentId: unit.raw_content_id,
            unitIndex: unit.unit_index,
            qualityScore: unit.quality_score,
            contentType: unit.content_type,
            summary: unit.summary,
            sentiment: unit.sentiment,
            language: unit.language,
            qdrantId: unit.qdrant_id,
            createdAt: unit.created_at,
        };
    }
}
