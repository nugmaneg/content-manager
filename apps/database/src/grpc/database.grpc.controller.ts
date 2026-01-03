import { Controller, Logger } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';
import { PrismaService } from '../storage/prisma.service';
import { QdrantService } from '../storage/qdrant.service';

// --- REQUEST INTERFACES ---

// Content
interface GetContentRequest { id: string; }
interface ListContentRequest { limit?: number; offset?: number; sourceId?: string; status?: string; }
interface CreateContentRequest { external_id: string; source_id: string; text?: string; raw_data_json?: string; received_via_id?: string; source_date?: string; }
interface UpdateContentRequest { id: string; text?: string; is_vectorized?: boolean; qdrant_id?: string; embedding_model?: string; ai_analysis_json?: string; status?: string; }

// Source
interface GetSourceRequest { id: string; }
interface ListSourcesRequest { limit?: number; offset?: number; type?: string; }

// Topic
interface GetTopicRequest { id: string; }
interface ListTopicsRequest { limit?: number; offset?: number; type?: string; category_id?: string; only_active?: boolean; }
interface CreateTopicRequest { type: string; title: string; summary?: string; language?: string; category_id?: string; embedding_model?: string; qdrant_id?: string; }
interface UpdateTopicRequest { id: string; title?: string; summary?: string; version?: number; relevance_score?: number; is_expired?: boolean; embedding_model?: string; qdrant_id?: string; qdrant_id_to_null?: string; }
interface AddContentToTopicRequest { topic_id: string; content_id: string; is_primary?: boolean; }

// Publication
interface GetPublicationRequest { id: string; }
interface ListPublicationsRequest { limit?: number; offset?: number; status?: string; target_id?: string; only_due?: boolean; }
interface CreatePublicationRequest { workspace_topic_id: string; target_id: string; topic_version: number; scheduled_at?: string; content_override_json?: string; }
interface UpdatePublicationStatusRequest { id: string; status: string; error?: string; external_id?: string; published_at?: string; retry_count?: number; next_retry_at?: string; }

// AiLog
interface CreateAiLogRequest { agent_id?: string; resource_type: string; resource_id: string; prompt?: string; response?: string; input_tokens?: number; output_tokens?: number; latency_ms?: number; cost?: number; success: boolean; error?: string; }

// Search
interface SearchSimilarRequest { vector: number[]; limit?: number; min_score?: number; }

// User (Auth) - fields must match proto definition (snake_case)
interface GetUserByIdRequest { id: string; }
interface GetUserByEmailRequest { email: string; }
interface CreateUserRequest { email: string; name?: string; password_hash: string; role?: string; }
interface UpdateUserRefreshTokenRequest { id: string; refresh_token_hash: string; }
interface CountUsersRequest { }

@Controller()
export class DatabaseGrpcController {
    private readonly logger = new Logger(DatabaseGrpcController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly qdrant: QdrantService,
    ) { }

    // ===================================
    // CONTENT
    // ===================================

    @GrpcMethod('DatabaseService', 'GetContent')
    async getContent(data: GetContentRequest) {
        if (!data.id) throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'Content ID required' });

        const content = await this.prisma.content.findUnique({ where: { id: data.id } });
        if (!content) throw new RpcException({ code: status.NOT_FOUND, message: `Content not found: ${data.id}` });

        return this.mapContent(content);
    }

    @GrpcMethod('DatabaseService', 'ListContent')
    async listContent(data: ListContentRequest) {
        const limit = Math.min(data.limit || 10, 100);
        const offset = data.offset || 0;
        const where: any = {};
        if (data.sourceId) where.sourceId = data.sourceId;
        if (data.status) where.status = data.status;

        const [items, total] = await Promise.all([
            this.prisma.content.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: 'desc' } }),
            this.prisma.content.count({ where }),
        ]);

        return { items: items.map(this.mapContent), total };
    }

    @GrpcMethod('DatabaseService', 'CreateContent')
    async createContent(data: CreateContentRequest) {
        try {
            const content = await this.prisma.content.create({
                data: {
                    externalId: data.external_id,
                    sourceId: data.source_id,
                    text: data.text,
                    rawData: data.raw_data_json ? JSON.parse(data.raw_data_json) : undefined,
                    receivedViaId: data.received_via_id,
                    sourceDate: data.source_date ? new Date(data.source_date) : undefined,
                }
            });
            return this.mapContent(content);
        } catch (e) {
            this.logger.error(e);
            throw new RpcException({ code: status.INTERNAL, message: 'Failed to create content' });
        }
    }

    @GrpcMethod('DatabaseService', 'UpdateContent')
    async updateContent(data: UpdateContentRequest) {
        try {
            const updateData: any = {};
            if (data.text !== undefined) updateData.text = data.text;
            if (data.is_vectorized !== undefined) updateData.isVectorized = data.is_vectorized;
            if (data.qdrant_id !== undefined) updateData.qdrantId = data.qdrant_id;
            if (data.embedding_model !== undefined) updateData.embeddingModel = data.embedding_model;
            if (data.status !== undefined) updateData.status = data.status;
            if (data.ai_analysis_json !== undefined) updateData.aiAnalysis = JSON.parse(data.ai_analysis_json);

            const content = await this.prisma.content.update({
                where: { id: data.id },
                data: updateData
            });
            return this.mapContent(content);
        } catch (e) {
            throw new RpcException({ code: status.NOT_FOUND, message: `Content not found or update failed` });
        }
    }

    // ===================================
    // SOURCE
    // ===================================

    @GrpcMethod('DatabaseService', 'GetSource')
    async getSource(data: GetSourceRequest) {
        const source = await this.prisma.source.findUnique({ where: { id: data.id } });
        if (!source) throw new RpcException({ code: status.NOT_FOUND, message: 'Source not found' });
        return this.mapSource(source);
    }

    @GrpcMethod('DatabaseService', 'ListSources')
    async listSources(data: ListSourcesRequest) {
        const where: any = {};
        if (data.type) where.type = data.type;

        const [items, total] = await Promise.all([
            this.prisma.source.findMany({ where, take: data.limit || 10, skip: data.offset || 0 }),
            this.prisma.source.count({ where })
        ]);

        return { items: items.map(this.mapSource), total };
    }

    // ===================================
    // TOPIC
    // ===================================

    @GrpcMethod('DatabaseService', 'GetTopic')
    async getTopic(data: GetTopicRequest) {
        const topic = await this.prisma.topic.findUnique({ where: { id: data.id } });
        if (!topic) throw new RpcException({ code: status.NOT_FOUND, message: 'Topic not found' });
        return this.mapTopic(topic);
    }

    @GrpcMethod('DatabaseService', 'ListTopics')
    async listTopics(data: ListTopicsRequest) {
        const where: any = {};
        if (data.type) where.type = data.type as any;
        if (data.category_id) where.categoryId = data.category_id;
        if (data.only_active) where.isExpired = false;

        const [items, total] = await Promise.all([
            this.prisma.topic.findMany({ where, take: data.limit || 10, skip: data.offset || 0, orderBy: { createdAt: 'desc' } }),
            this.prisma.topic.count({ where })
        ]);
        return { items: items.map(this.mapTopic), total };
    }

    @GrpcMethod('DatabaseService', 'CreateTopic')
    async createTopic(data: CreateTopicRequest) {
        const topic = await this.prisma.topic.create({
            data: {
                type: data.type as any,
                title: data.title,
                summary: data.summary,
                language: data.language || 'ru',
                categoryId: data.category_id,
                embeddingModel: data.embedding_model,
                qdrantId: data.qdrant_id,
            }
        });
        return this.mapTopic(topic);
    }

    @GrpcMethod('DatabaseService', 'UpdateTopic')
    async updateTopic(data: UpdateTopicRequest) {
        const updateData: any = {};
        if (data.title) updateData.title = data.title;
        if (data.summary) updateData.summary = data.summary;
        if (data.version) updateData.version = data.version;
        if (data.relevance_score) updateData.relevanceScore = data.relevance_score;
        if (data.is_expired !== undefined) updateData.isExpired = data.is_expired;
        if (data.embedding_model) updateData.embeddingModel = data.embedding_model;
        if (data.qdrant_id) updateData.qdrantId = data.qdrant_id;
        if (data.qdrant_id_to_null) updateData.qdrantId = null;

        const topic = await this.prisma.topic.update({
            where: { id: data.id },
            data: updateData
        });
        return this.mapTopic(topic);
    }

    @GrpcMethod('DatabaseService', 'AddContentToTopic')
    async addContentToTopic(data: AddContentToTopicRequest) {
        await this.prisma.contentTopic.create({
            data: {
                topicId: data.topic_id,
                contentId: data.content_id,
                isPrimary: data.is_primary || false
            }
        });
        // Return updated topic
        return this.getTopic({ id: data.topic_id });
    }

    // ===================================
    // PUBLICATION
    // ===================================

    @GrpcMethod('DatabaseService', 'GetPublication')
    async getPublication(data: GetPublicationRequest) {
        const pub = await this.prisma.publication.findUnique({ where: { id: data.id } });
        if (!pub) throw new RpcException({ code: status.NOT_FOUND, message: 'Publication not found' });
        return this.mapPublication(pub);
    }

    @GrpcMethod('DatabaseService', 'ListPublications')
    async listPublications(data: ListPublicationsRequest) {
        const where: any = {};
        if (data.status) where.status = data.status;
        if (data.target_id) where.targetId = data.target_id;
        if (data.only_due) {
            where.OR = [
                { status: 'PENDING' },
                { status: 'SCHEDULED', scheduledAt: { lte: new Date() } }
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.publication.findMany({ where, take: data.limit || 10, skip: data.offset || 0, orderBy: { createdAt: 'desc' } }),
            this.prisma.publication.count({ where })
        ]);
        return { items: items.map(this.mapPublication), total };
    }

    @GrpcMethod('DatabaseService', 'CreatePublication')
    async createPublication(data: CreatePublicationRequest) {
        try {
            const pub = await this.prisma.publication.create({
                data: {
                    workspaceTopicId: data.workspace_topic_id,
                    targetId: data.target_id,
                    topicVersion: data.topic_version,
                    scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : null,
                    contentOverride: data.content_override_json ? JSON.parse(data.content_override_json) : undefined,
                    status: data.scheduled_at ? 'SCHEDULED' : 'PENDING',
                }
            });
            return this.mapPublication(pub);
        } catch (e) {
            this.logger.error(e);
            throw new RpcException({ code: status.INTERNAL, message: 'Failed to create publication' });
        }
    }

    @GrpcMethod('DatabaseService', 'UpdatePublicationStatus')
    async updatePublicationStatus(data: UpdatePublicationStatusRequest) {
        try {
            const updateData: any = {};
            if (data.status) updateData.status = data.status;
            if (data.error !== undefined) updateData.error = data.error;
            if (data.external_id !== undefined) updateData.externalId = data.external_id;
            if (data.published_at) updateData.publishedAt = new Date(data.published_at);
            if (data.retry_count !== undefined) updateData.retryCount = data.retry_count;
            if (data.next_retry_at) updateData.nextRetryAt = new Date(data.next_retry_at);

            const pub = await this.prisma.publication.update({
                where: { id: data.id },
                data: updateData
            });
            return this.mapPublication(pub);
        } catch (e) {
            throw new RpcException({ code: status.NOT_FOUND, message: 'Publication not found or update failed' });
        }
    }

    // ===================================
    // AI LOG
    // ===================================

    @GrpcMethod('DatabaseService', 'CreateAiLog')
    async createAiLog(data: CreateAiLogRequest) {
        const log = await this.prisma.aiLog.create({
            data: {
                agentId: data.agent_id,
                resourceType: data.resource_type,
                resourceId: data.resource_id,
                prompt: data.prompt,
                response: data.response,
                inputTokens: data.input_tokens,
                outputTokens: data.output_tokens,
                latencyMs: data.latency_ms,
                cost: data.cost,
                success: data.success,
                error: data.error
            }
        });
        return { id: log.id, success: true };
    }

    // ===================================
    // SEARCH
    // ===================================

    @GrpcMethod('DatabaseService', 'SearchSimilarContent')
    async searchSimilarContent(data: SearchSimilarRequest) {
        if (!data.vector || data.vector.length === 0) {
            throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'Vector required' });
        }

        const results = await this.qdrant.searchSimilar(
            this.qdrant.getContentCollectionName(),
            data.vector,
            data.limit || 10,
            data.min_score
        );

        return {
            items: results.map((result) => ({
                id: result.payload?.contentId as string,
                text: result.payload?.text as string,
                score: result.score,
            })),
        };
    }

    @GrpcMethod('DatabaseService', 'SearchSimilarTopics')
    async searchSimilarTopics(data: SearchSimilarRequest) {
        if (!data.vector || data.vector.length === 0) {
            throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'Vector required' });
        }

        const results = await this.qdrant.searchSimilar(
            this.qdrant.getTopicCollectionName(),
            data.vector,
            data.limit || 10,
            data.min_score
        );

        return {
            items: results.map((result) => ({
                id: result.payload?.topicId as string,
                text: result.payload?.title as string,
                score: result.score,
            })),
        };
    }

    // ===================================
    // USER (Auth)
    // ===================================

    @GrpcMethod('DatabaseService', 'GetUserById')
    async getUserById(data: GetUserByIdRequest) {
        if (!data.id) throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'User ID required' });

        const user = await this.prisma.user.findUnique({ where: { id: data.id } });
        if (!user) throw new RpcException({ code: status.NOT_FOUND, message: 'User not found' });

        return this.mapUser(user);
    }

    @GrpcMethod('DatabaseService', 'GetUserByEmail')
    async getUserByEmail(data: GetUserByEmailRequest) {
        if (!data.email) throw new RpcException({ code: status.INVALID_ARGUMENT, message: 'Email required' });

        const user = await this.prisma.user.findUnique({ where: { email: data.email } });
        if (!user) throw new RpcException({ code: status.NOT_FOUND, message: 'User not found' });

        return this.mapUser(user);
    }

    @GrpcMethod('DatabaseService', 'CreateUser')
    async createUser(data: CreateUserRequest) {
        try {
            const user = await this.prisma.user.create({
                data: {
                    email: data.email,
                    name: data.name,
                    passwordHash: data.password_hash,
                    role: (data.role as any) || 'USER',
                }
            });
            return this.mapUser(user);
        } catch (e: any) {
            if (e.code === 'P2002') {
                throw new RpcException({ code: status.ALREADY_EXISTS, message: 'User with this email already exists' });
            }
            this.logger.error(e);
            throw new RpcException({ code: status.INTERNAL, message: 'Failed to create user' });
        }
    }

    @GrpcMethod('DatabaseService', 'UpdateUserRefreshToken')
    async updateUserRefreshToken(data: UpdateUserRefreshTokenRequest) {
        try {
            const user = await this.prisma.user.update({
                where: { id: data.id },
                data: { refreshTokenHash: data.refresh_token_hash || null }
            });
            return this.mapUser(user);
        } catch (e) {
            throw new RpcException({ code: status.NOT_FOUND, message: 'User not found' });
        }
    }

    @GrpcMethod('DatabaseService', 'CountUsers')
    async countUsers(_data: CountUsersRequest) {
        const count = await this.prisma.user.count();
        return { count };
    }

    // ===================================
    // HELPERS
    // ===================================

    private mapContent = (item: any) => {
        return {
            id: item.id,
            external_id: item.externalId,
            text: item.text ?? '',
            source_id: item.sourceId,
            received_via_id: item.receivedViaId ?? '',
            qdrant_id: item.qdrantId ?? '',
            is_vectorized: item.isVectorized,
            embedding_model: item.embeddingModel ?? '',
            created_at: item.createdAt.toISOString(),
            updated_at: item.updatedAt.toISOString(),
            raw_data_json: item.rawData ? JSON.stringify(item.rawData) : '',
            ai_analysis_json: item.aiAnalysis ? JSON.stringify(item.aiAnalysis) : '',
        };
    }

    private mapSource = (item: any) => {
        return {
            id: item.id,
            type: item.type,
            external_id: item.externalId,
            name: item.name ?? '',
            is_active: item.isActive,
            language: item.language ?? '',
            created_at: item.createdAt.toISOString()
        };
    }

    private mapTopic = (item: any) => {
        return {
            id: item.id,
            type: item.type,
            title: item.title,
            summary: item.summary ?? '',
            language: item.language,
            category_id: item.categoryId ?? '',
            version: item.version,
            relevance_score: item.relevanceScore,
            is_expired: item.isExpired,
            created_at: item.createdAt.toISOString(),
            updated_at: item.updatedAt.toISOString(),
        };
    }

    private mapPublication = (item: any) => {
        return {
            id: item.id,
            workspace_topic_id: item.workspaceTopicId,
            target_id: item.targetId,
            status: item.status,
            topic_version: item.topicVersion,
            scheduled_at: item.scheduledAt ? item.scheduledAt.toISOString() : '',
            published_at: item.publishedAt ? item.publishedAt.toISOString() : '',
            external_id: item.externalId ?? '',
            error: item.error ?? '',
            retry_count: item.retryCount,
            next_retry_at: item.nextRetryAt ? item.nextRetryAt.toISOString() : '',
            created_at: item.createdAt.toISOString(),
        };
    }

    private mapUser = (item: any) => {
        return {
            id: item.id,
            email: item.email,
            name: item.name ?? '',
            password_hash: item.passwordHash,
            is_active: item.isActive,
            role: item.role,
            telegram_id: item.telegramId ?? '',
            telegram_username: item.telegramUsername ?? '',
            avatar_url: item.avatarUrl ?? '',
            refresh_token_hash: item.refreshTokenHash ?? '',
            created_at: item.createdAt.toISOString(),
            updated_at: item.updatedAt.toISOString(),
        };
    }
}
