import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth';
import { DatabaseGrpcClient, TopicResponse } from '../grpc';

@Controller('api/topics')
@UseGuards(JwtAuthGuard)
export class TopicsController {
    private readonly logger = new Logger(TopicsController.name);

    constructor(private readonly dbClient: DatabaseGrpcClient) { }

    @Get()
    async findAll(
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
        @Query('type') type?: string,
        @Query('categoryId') categoryId?: string,
        @Query('activeOnly') activeOnly?: string,
    ) {
        const result = await this.dbClient.listTopics({
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            type,
            categoryId,
            onlyActive: activeOnly === 'true',
        });

        return {
            items: result.topics.map(this.formatTopic),
            total: result.total,
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const topic = await this.dbClient.getTopic(id);
        if (!topic) {
            throw new NotFoundException(`Topic with ID ${id} not found`);
        }
        return this.formatTopic(topic);
    }

    /*
    @Post()
    async create(@Body() data: any) {
      // Implement create if needed
    }
    */

    private formatTopic(topic: TopicResponse) {
        return {
            id: topic.id,
            type: topic.type,
            title: topic.title,
            summary: topic.summary,
            language: topic.language,
            categoryId: topic.category_id,
            version: topic.version,
            relevanceScore: topic.relevance_score,
            isExpired: topic.is_expired,
            factCheckStatus: topic.fact_check_status,
            // factCheckResult: topic.fact_check_result_json ? JSON.parse(topic.fact_check_result_json) : null,
            createdAt: topic.created_at,
            updatedAt: topic.updated_at,
        };
    }
}
