import { Controller, Get, Param, Query, UseGuards, Logger, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth';
import { DatabaseGrpcClient, ContentResponse } from '../grpc';

@Controller('api/content')
@UseGuards(JwtAuthGuard)
export class ContentController {
    private readonly logger = new Logger(ContentController.name);

    constructor(
        private readonly dbClient: DatabaseGrpcClient,
    ) { }

    @Get()
    async findAll(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('sourceId') sourceId?: string,
        @Query('status') status?: string,
    ) {
        const result = await this.dbClient.listContent({
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            sourceId,
            status,
        });

        return {
            items: result.items.map(this.formatContent),
            total: result.total,
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const content = await this.dbClient.getContent(id);
        if (!content) {
            throw new NotFoundException(`Content with ID ${id} not found`);
        }
        return this.formatContent(content);
    }

    private formatContent(content: ContentResponse) {
        return {
            id: content.id,
            externalId: content.external_id,
            text: content.text,
            sourceId: content.source_id,
            receivedViaId: content.received_via_id,
            qdrantId: content.qdrant_id,
            isVectorized: content.is_vectorized,
            embeddingModel: content.embedding_model,
            status: (content as any).status || 'pending', // Fallback if status isn't in response yet
            aiAnalysis: content.ai_analysis_json ? JSON.parse(content.ai_analysis_json) : null,
            rawData: content.raw_data_json ? JSON.parse(content.raw_data_json) : null,
            createdAt: content.created_at,
            updatedAt: content.updated_at,
        };
    }
}
