import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth';
import { DatabaseGrpcClient, ContentResponse } from '../grpc';

@Controller('api/content')
@UseGuards(JwtAuthGuard)
export class ContentController {
  private readonly logger = new Logger(ContentController.name);

  constructor(private readonly dbClient: DatabaseGrpcClient) { }

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
      aiAnalysis: content.ai_analysis_json
        ? JSON.parse(content.ai_analysis_json)
        : null,
      rawData: content.raw_data_json ? JSON.parse(content.raw_data_json) : null,
      createdAt: content.created_at,
      updatedAt: content.updated_at,
      rawContent: content.raw_content
        ? this.formatRawContent(content.raw_content)
        : null,
      contentUnits: content.content_units
        ? content.content_units.map((u) => this.formatContentUnit(u))
        : [],
    };
  }

  private formatRawContent(raw: any) {
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
    };
  }

  private formatContentUnit(unit: any) {
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
